package expo.modules.idphotodetector

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.media.FaceDetector
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import java.util.concurrent.TimeUnit
import kotlin.math.*
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceContour
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class IDPhotoDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PinPicIDPhotoDetector")

    AsyncFunction("detectFace") Coroutine { uri: Uri ->
      val source = appContext.reactContext?.contentResolver?.openInputStream(uri)?.use(BitmapFactory::decodeStream)
        ?: uri.path?.let { BitmapFactory.decodeFile(it) }
        ?: throw IllegalArgumentException("无法读取照片。")
      val scale = minOf(640.0 / source.width, 640.0 / source.height, 1.0)
      val width = ((source.width * scale).toInt() / 2 * 2).coerceAtLeast(2)
      val height = (source.height * scale).toInt().coerceAtLeast(2)
      var bitmap = Bitmap.createScaledBitmap(source, width, height, true)
      if (bitmap.config != Bitmap.Config.RGB_565) bitmap = bitmap.copy(Bitmap.Config.RGB_565, false)
      if (source !== bitmap) source.recycle()
      val face = arrayOfNulls<FaceDetector.Face>(4)
      val count = try { FaceDetector(width, height, face.size).findFaces(bitmap, face) } catch (_: Exception) { 0 }
      val found = face.take(count).filterNotNull()
      bitmap.recycle()
      if (found.size != 1) return@Coroutine mapOf("valid" to false, "reason" to if (found.isEmpty()) "没有检测到清晰正脸，请选择正面、光线充足的单人照片。" else "照片中检测到多个人，请选择只包含一人的照片。")
      val detected = found.first()
      val midpoint = android.graphics.PointF()
      detected.getMidPoint(midpoint)
      val eyeDistance = detected.eyesDistance()
      val faceWidth = (eyeDistance * 2.15f / width).toDouble()
      val faceHeight = (eyeDistance * 2.65f / height).toDouble()
      val centerX = (midpoint.x / width).toDouble()
      val centerY = (midpoint.y / height).toDouble()
      val box = mapOf("x" to (centerX - faceWidth / 2).coerceAtLeast(0.0), "y" to (centerY - faceHeight / 2).coerceAtLeast(0.0), "width" to faceWidth, "height" to faceHeight)
      val valid = faceWidth > 0.055 && faceHeight > 0.075 && faceWidth < 0.72 && faceHeight < 0.78 && centerX > 0.15 && centerX < 0.85 && centerY > 0.20 && centerY < 0.88
      mapOf("valid" to valid, "reason" to if (valid) "" else "人像位置或大小不符合证件照要求，请调整后重新选择。", "face" to box)
    }

    AsyncFunction("replaceBackgroundEnhanced") Coroutine { uri: Uri, colorHex: String, effects: Map<String, Double> ->
      fun strength(key: String) = ((effects[key] ?: 0.0).coerceIn(0.0,100.0)/100).toFloat()
      val context = appContext.reactContext ?: throw IllegalStateException("应用上下文不可用。")
      val source = context.contentResolver.openInputStream(uri)?.use(BitmapFactory::decodeStream)
        ?: uri.path?.let { BitmapFactory.decodeFile(it) }
        ?: throw IllegalArgumentException("无法处理照片。")
      try {
        require(source.width * source.height <= 1_600_000) { "照片尺寸过大，请重新选取或裁剪照片。" }
        val width = source.width
        val height = source.height
        // The model is bundled with the APK. SINGLE_IMAGE_MODE does not carry
        // a previous frame's mask into a different photo.
        val segmenter = Segmentation.getClient(
          SelfieSegmenterOptions.Builder()
            .setDetectorMode(SelfieSegmenterOptions.SINGLE_IMAGE_MODE).build()
        )
        val mask = try {
          Tasks.await(segmenter.process(InputImage.fromBitmap(source, 0)), 30, TimeUnit.SECONDS)
        } finally { segmenter.close() }
        require(mask.width == width && mask.height == height) { "人像分割尺寸异常，请重新选择照片。" }
        val confidence = mask.buffer
        confidence.rewind()
        val pixels = IntArray(width * height)
        source.getPixels(pixels, 0, width, 0, 0, width, height)
        val background = Color.parseColor(if (colorHex.startsWith("#")) colorHex else "#$colorHex")

        val probabilities = FloatArray(pixels.size) { confidence.float.also { p -> require(p.isFinite()) { "人像识别失败，请更换照片。" } } }
        val matte = PortraitPixels.matte(pixels, probabilities, width, height)
        val originalPixels = pixels.copyOf()
        val smoothRadius = max(1, min(width,height)/150)
        val meanR = if (strength("smooth") > 0 || strength("detail") > 0) PortraitPixels.mean(FloatArray(pixels.size) { Color.red(pixels[it]).toFloat() },width,height,smoothRadius) else null
        val meanG = if (meanR != null) PortraitPixels.mean(FloatArray(pixels.size) { Color.green(pixels[it]).toFloat() },width,height,smoothRadius) else null
        val meanB = if (meanR != null) PortraitPixels.mean(FloatArray(pixels.size) { Color.blue(pixels[it]).toFloat() },width,height,smoothRadius) else null
        val detector = FaceDetection.getClient(FaceDetectorOptions.Builder().setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL).setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE).build())
        val faces = try { if (effects.values.any { it > 0 }) Tasks.await(detector.process(InputImage.fromBitmap(source,0)),30,TimeUnit.SECONDS) else emptyList() } finally { detector.close() }
        // Only apply cosmetics to a single reliably detected face.
        val face = faces.singleOrNull()
        val box = face?.boundingBox
        val lip = face?.getContour(FaceContour.UPPER_LIP_TOP)?.points.orEmpty() + face?.getContour(FaceContour.LOWER_LIP_BOTTOM)?.points.orEmpty()
        fun insideLip(x: Float,y: Float): Boolean {
          if (lip.size < 6) return false
          var inside=false; var j=lip.size-1
          for (i in lip.indices) { val a=lip[i]; val b=lip[j]; if ((a.y>y)!=(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside; j=i }
          return inside
        }
        var foregroundCount = 0
        for (index in pixels.indices) {
          val alpha = matte[index]
          if (alpha > .95f) foregroundCount++
          val x = index % width; val y = index / width
          val clean = PortraitPixels.edgeColor(originalPixels,matte,width,height,x,y,alpha)
          var red = Color.red(clean).toFloat(); var green = Color.green(clean).toFloat(); var blue = Color.blue(clean).toFloat()
          if (box != null && alpha > .98f) {
            val dx=(x-box.exactCenterX())/max(1f,box.width()*.5f)
            val dy=(y-box.exactCenterY())/max(1f,box.height()*.5f)
            val oval=(1-dx*dx-dy*dy).coerceIn(0f,1f)
            // Protect eyes, glasses, hair, teeth and clothing using a skin gate.
            val skin=if (red>green*1.02f && red>blue*1.06f && red>55 && red-min(green,blue)>8) oval else 0f
            if (skin>0 && meanR != null && meanG != null && meanB != null) {
              val contrast=abs(red-meanR[index])+abs(green-meanG[index])+abs(blue-meanB[index])
              val smooth=strength("smooth")*.65f*skin*(1-contrast/45).coerceIn(0f,1f)
              red+=(meanR[index]-red)*smooth; green+=(meanG[index]-green)*smooth; blue+=(meanB[index]-blue)*smooth
              val detail=strength("detail")*.35f*oval
              red+=(Color.red(clean)-meanR[index])*detail; green+=(Color.green(clean)-meanG[index])*detail; blue+=(Color.blue(clean)-meanB[index])*detail
            }
            val light=strength("brighten")*.18f*skin
            red+=(255-red)*light; green+=(255-green)*light; blue+=(255-blue)*light
            val tone=strength("tone")*skin
            red+=4*tone; green+=2*tone; blue-=2*tone
            // Blush follows face position, with a smooth elliptical falloff.
            val cheekY=box.top+box.height()*.61f
            val cheekX=if(x<box.exactCenterX()) box.left+box.width()*.25f else box.left+box.width()*.75f
            val cx=(x-cheekX)/max(1f,box.width()*.16f); val cy=(y-cheekY)/max(1f,box.height()*.10f)
            val blush=(1-cx*cx-cy*cy).coerceIn(0f,1f)*strength("blush")*.22f*skin
            red+=(220-red)*blush; green+=(105-green)*blush; blue+=(120-blue)*blush
            // Lip geometry plus chroma gating avoids colouring the teeth.
            if (insideLip(x.toFloat(),y.toFloat()) && red>green*1.12f && red>blue*1.08f) {
              val lipstick=strength("lipstick")*.40f
              red+=(186-red)*lipstick; green+=(68-green)*lipstick; blue+=(88-blue)*lipstick
            }
          }
          red=red.coerceIn(0f,255f); green=green.coerceIn(0f,255f); blue=blue.coerceIn(0f,255f)
          pixels[index] = Color.rgb(
            (red * alpha + Color.red(background) * (1 - alpha)).roundToInt(),
            (green * alpha + Color.green(background) * (1 - alpha)).roundToInt(),
            (blue * alpha + Color.blue(background) * (1 - alpha)).roundToInt()
          )
        }
        require(foregroundCount > pixels.size / 50 && foregroundCount < pixels.size * 99 / 100) {
          "未能可靠分离人物与背景，请选用正面、清晰的单人照片。"
        }
        val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
          output.setPixels(pixels, 0, width, 0, 0, width, height)
          // Lossless intermediate avoids recoloring clothing through JPEG artifacts.
          val file = File(context.cacheDir, "PinPic_ID_${System.currentTimeMillis()}.png")
          FileOutputStream(file).use { check(output.compress(Bitmap.CompressFormat.PNG, 100, it)) }
          mapOf("uri" to Uri.fromFile(file).toString(), "width" to width, "height" to height)
        } finally { output.recycle() }
      } finally { source.recycle() }
    }
  }
}
