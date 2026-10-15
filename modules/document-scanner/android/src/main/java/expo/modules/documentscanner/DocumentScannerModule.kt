package expo.modules.documentscanner

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.*

class DocumentScannerModule : Module() {
  private val context get() = appContext.reactContext ?: error("应用上下文不可用。")
  private fun initCV() { check(OpenCVLoader.initLocal()) { "扫描图像引擎无法加载，请重新安装应用。" } }
  private fun file(ext: String) = File(context.cacheDir, "scan-${UUID.randomUUID()}.$ext")
  private fun read(uri: Uri, limit: Int = 2600): Bitmap {
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it, null, options) }
    require(options.outWidth > 0 && options.outHeight > 0) { "无法读取扫描图片。" }
    var sample = 1
    while (max(options.outWidth, options.outHeight) / sample > limit * 1.5) sample *= 2
    options.inJustDecodeBounds = false; options.inSampleSize = sample
    var bitmap = context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it, null, options) } ?: error("无法解码扫描图片。")
    val orientation = context.contentResolver.openInputStream(uri)!!.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) }
    val matrix = Matrix()
    when (orientation) {
      2 -> matrix.setScale(-1f, 1f)
      3 -> matrix.setRotate(180f)
      4 -> matrix.setScale(1f, -1f)
      5 -> { matrix.setRotate(90f); matrix.postScale(-1f, 1f) }
      6 -> matrix.setRotate(90f)
      7 -> { matrix.setRotate(270f); matrix.postScale(-1f, 1f) }
      8 -> matrix.setRotate(270f)
    }
    if (!matrix.isIdentity) { val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true); if (rotated !== bitmap) bitmap.recycle(); bitmap = rotated }
    val scale = min(1.0, limit.toDouble() / max(bitmap.width, bitmap.height))
    if (scale < 1) { val resized = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).roundToInt(), (bitmap.height * scale).roundToInt(), true); bitmap.recycle(); bitmap = resized }
    return bitmap
  }
  private fun save(bitmap: Bitmap): Map<String, Any> {
    val target = file("jpg")
    target.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it)) }
    return mapOf("uri" to Uri.fromFile(target).toString(), "width" to bitmap.width, "height" to bitmap.height)
  }
  private fun order(points: Array<Point>): Array<Point> {
    val center = Point(points.map { it.x }.average(), points.map { it.y }.average())
    val sorted = points.sortedBy { atan2(it.y - center.y, it.x - center.x) }
    val start = sorted.indices.minBy { sorted[it].x + sorted[it].y }
    return Array(4) { sorted[(start + it) % 4] }
  }
  // Multiple thresholds handle both low-contrast paper and strong document borders.
  // Only convex, sizeable quadrilaterals are accepted; uncertain images use an
  // explicitly marked full-region fallback which the user can adjust.
  private fun detectRegion(bitmap: Bitmap, region: Rect): Map<String, Any> {
    val crop = Bitmap.createBitmap(bitmap, region.left, region.top, region.width(), region.height())
    val rgba = Mat(); val gray = Mat(); val blurred = Mat(); val binary = Mat(); val hierarchy = Mat()
    var best: Array<Point>? = null; var bestScore = 0.0
    try {
      Utils.bitmapToMat(crop, rgba); Imgproc.cvtColor(rgba, gray, Imgproc.COLOR_RGBA2GRAY)
      Imgproc.GaussianBlur(gray, blurred, Size(5.0, 5.0), 0.0)
      for (pass in 0..2) {
        if (pass == 0) { Imgproc.Canny(blurred, binary, 45.0, 135.0); val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(5.0, 5.0)); try { Imgproc.morphologyEx(binary, binary, Imgproc.MORPH_CLOSE, kernel) } finally { kernel.release() } }
        else Imgproc.threshold(blurred, binary, if (pass == 1) 0.0 else 170.0, 255.0, if (pass == 1) Imgproc.THRESH_BINARY + Imgproc.THRESH_OTSU else Imgproc.THRESH_BINARY)
        val contours = mutableListOf<MatOfPoint>()
        try {
          Imgproc.findContours(binary, contours, hierarchy, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE)
          for (contour in contours) {
            val area = abs(Imgproc.contourArea(contour)); val fraction = area / (crop.width.toDouble() * crop.height)
            if (fraction < 0.16 || fraction > 0.995) continue
            val curve = MatOfPoint2f(*contour.toArray()); val approx = MatOfPoint2f()
            try {
              Imgproc.approxPolyDP(curve, approx, Imgproc.arcLength(curve, true) * 0.025, true)
              if (approx.total() != 4L) continue
              val polygon = MatOfPoint(*approx.toArray())
              val convex = try { Imgproc.isContourConvex(polygon) } finally { polygon.release() }
              if (!convex) continue
              val p = order(approx.toArray())
              val cosine = p.indices.maxOf { i -> val a = p[(i + 3) % 4]; val b = p[i]; val c = p[(i + 1) % 4]; abs(((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y)) / (hypot(a.x-b.x,a.y-b.y)*hypot(c.x-b.x,c.y-b.y)).coerceAtLeast(1.0)) }
              if (cosine > 0.8) continue
              val score = fraction * (1 - cosine * 0.3)
              if (score > bestScore) { bestScore = score; best = p }
            } finally { curve.release(); approx.release() }
          }
        } finally { contours.forEach { it.release() } }
      }
      val points = best ?: arrayOf(Point(0.0, 0.0), Point((crop.width - 1).toDouble(), 0.0), Point((crop.width - 1).toDouble(), (crop.height - 1).toDouble()), Point(0.0, (crop.height - 1).toDouble()))
      return mapOf("detected" to (best != null), "points" to points.map { mapOf("x" to (it.x + region.left) / (bitmap.width - 1), "y" to (it.y + region.top) / (bitmap.height - 1)) })
    } finally { rgba.release(); gray.release(); blurred.release(); binary.release(); hierarchy.release(); if (crop !== bitmap) crop.recycle() }
  }
  override fun definition() = ModuleDefinition {
    Name("PinPicDocumentScanner")
    AsyncFunction("detect") Coroutine { uri: Uri, split: String ->
      initCV(); val bitmap = read(uri, 1000)
      try {
        val w = bitmap.width; val h = bitmap.height
        val regions = when (split) {
          "vertical" -> listOf(Rect(0, 0, w / 2, h), Rect(w / 2, 0, w, h))
          "horizontal" -> listOf(Rect(0, 0, w, h / 2), Rect(0, h / 2, w, h))
          else -> listOf(Rect(0, 0, w, h))
        }
        mapOf("width" to w, "height" to h, "regions" to regions.map { detectRegion(bitmap, it) })
      } finally { bitmap.recycle() }
    }
    AsyncFunction("process") Coroutine { uri: Uri, coordinates: List<Double>, rotation: Int, filter: String ->
      initCV(); require(coordinates.size == 8 && coordinates.all { it.isFinite() && it in 0.0..1.0 }) { "裁切坐标无效。" }
      val bitmap = read(uri); val src = Mat(); val dst = Mat()
      try {
        val p = Array(4) { i -> Point(coordinates[i * 2] * (bitmap.width - 1), coordinates[i * 2 + 1] * (bitmap.height - 1)) }
        val w = max(hypot(p[1].x-p[0].x,p[1].y-p[0].y),hypot(p[2].x-p[3].x,p[2].y-p[3].y)).roundToInt().coerceAtLeast(32)
        val h = max(hypot(p[3].x-p[0].x,p[3].y-p[0].y),hypot(p[2].x-p[1].x,p[2].y-p[1].y)).roundToInt().coerceAtLeast(32)
        val shape = MatOfPoint(*p); val valid = try { Imgproc.isContourConvex(shape) && abs(Imgproc.contourArea(shape)) > bitmap.width * bitmap.height * 0.005 } finally { shape.release() }
        require(valid) { "裁切范围过小或边线交叉，请重新调整。" }
        Utils.bitmapToMat(bitmap, src)
        val from = MatOfPoint2f(*p); val to = MatOfPoint2f(Point(0.0,0.0),Point((w-1).toDouble(),0.0),Point((w-1).toDouble(),(h-1).toDouble()),Point(0.0,(h-1).toDouble()))
        val transform = Imgproc.getPerspectiveTransform(from, to)
        try { Imgproc.warpPerspective(src, dst, transform, Size(w.toDouble(),h.toDouble()), Imgproc.INTER_CUBIC, Core.BORDER_REPLICATE) } finally { from.release(); to.release(); transform.release() }
        if (filter == "gray" || filter == "bw" || filter == "clean") {
          Imgproc.cvtColor(dst, dst, Imgproc.COLOR_RGBA2GRAY)
          if (filter == "bw") Imgproc.adaptiveThreshold(dst,dst,255.0,Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,Imgproc.THRESH_BINARY,31,12.0)
          if (filter == "clean") {
            val background = Mat(); try { Imgproc.GaussianBlur(dst,background,Size(0.0,0.0),max(w,h)/30.0); Core.divide(dst,background,dst,240.0) } finally { background.release() }
          }
          Imgproc.cvtColor(dst,dst,Imgproc.COLOR_GRAY2RGBA)
        } else if (filter == "enhance") dst.convertTo(dst,-1,1.12,-10.0)
        when (((rotation % 4) + 4) % 4) { 1 -> Core.rotate(dst,dst,Core.ROTATE_90_CLOCKWISE); 2 -> Core.rotate(dst,dst,Core.ROTATE_180); 3 -> Core.rotate(dst,dst,Core.ROTATE_90_COUNTERCLOCKWISE) }
        val output = Bitmap.createBitmap(dst.cols(),dst.rows(),Bitmap.Config.ARGB_8888)
        try { Utils.matToBitmap(dst,output); save(output) } finally { output.recycle() }
      } finally { bitmap.recycle(); src.release(); dst.release() }
    }
    AsyncFunction("export") Coroutine { uris: List<String>, kind: String, title: String ->
      require(uris.isNotEmpty() && uris.size <= 50) { "请选择 1–50 页导出。" }
      val result = when(kind) {
        "pdf" -> exportPDF(uris)
        "word" -> exportWord(uris)
        "long" -> exportLong(uris)
        else -> error("未知导出格式。")
      }
      val original = File(Uri.parse(result).path!!)
      val safeName = title.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").take(60).ifBlank { "扫描" }
      val destination = File(context.cacheDir, "scan-$safeName-${System.currentTimeMillis()}.${original.extension}")
      check(original.renameTo(destination)) { "导出文件命名失败，请重试。" }
      Uri.fromFile(destination).toString()
    }
    AsyncFunction("saveExport") Coroutine { uri: String, title: String, mime: String, extension: String ->
      check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { "保存到下载文件夹需要 Android 10 或更新版本。" }
      val source = File(Uri.parse(uri).path ?: error("导出文件不存在。"))
      require(source.exists()) { "导出文件不存在。" }
      val safeName = title.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").take(60).ifBlank { "扫描" }
      val values = android.content.ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, "$safeName-${System.currentTimeMillis()}.$extension")
        put(MediaStore.MediaColumns.MIME_TYPE, mime)
        put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/PinPic")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      val target = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("无法创建系统文件。")
      try {
        val output = context.contentResolver.openOutputStream(target) ?: error("无法写入下载文件夹。")
        output.use { out -> source.inputStream().use { it.copyTo(out) } }
        val completed = android.content.ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
        check(context.contentResolver.update(target, completed, null, null) > 0) { "文件保存未完成，请重试。" }
        target.toString()
      } catch (error: Exception) {
        context.contentResolver.delete(target, null, null)
        throw error
      }
    }
    AsyncFunction("removeTemp") Coroutine { uris: List<String> ->
      uris.forEach { value -> val uri = Uri.parse(value); val target = uri.path?.let { File(it) }; if (uri.scheme == "file" && target != null && target.canonicalFile.parentFile == context.cacheDir.canonicalFile && target.name.startsWith("scan-")) target.delete() }
    }
  }
  private fun exportPDF(uris: List<String>): String {
    val document = PdfDocument(); val target = file("pdf")
    try {
      uris.forEachIndexed { index, uri -> val bitmap = read(Uri.parse(uri)); try {
        val landscape = bitmap.width > bitmap.height; val w = if(landscape) 842 else 595; val h = if(landscape) 595 else 842
        val page = document.startPage(PdfDocument.PageInfo.Builder(w,h,index+1).create())
        page.canvas.drawColor(Color.WHITE); val scale = min((w-32).toFloat()/bitmap.width,(h-32).toFloat()/bitmap.height)
        val dw = bitmap.width*scale; val dh = bitmap.height*scale
        page.canvas.drawBitmap(bitmap,null,RectF((w-dw)/2,(h-dh)/2,(w+dw)/2,(h+dh)/2),Paint(Paint.FILTER_BITMAP_FLAG)); document.finishPage(page)
      } finally { bitmap.recycle() } }
      target.outputStream().use { document.writeTo(it) }
      return Uri.fromFile(target).toString()
    } catch (e: Exception) { target.delete(); throw e } finally { document.close() }
  }
  private fun exportLong(uris: List<String>): String {
    val ratios = uris.map { uri ->
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      context.contentResolver.openInputStream(Uri.parse(uri))!!.use { BitmapFactory.decodeStream(it,null,bounds) }
      require(bounds.outWidth > 0 && bounds.outHeight > 0) { "无法读取长图页面。" }
      bounds.outHeight.toDouble() / bounds.outWidth
    }
    // Bound both height and pixel count to avoid exhausting typical phone heaps.
    val width = minOf(1400, (28000 / ratios.sum()).toInt(), sqrt(16000000 / ratios.sum()).toInt()).coerceAtLeast(1)
    require(width >= 240) { "页数过多，长图文字会过小，请减少页数或使用 PDF。" }
    val heights = ratios.map { max(1,(it*width).roundToInt()) }; val output = Bitmap.createBitmap(width,heights.sum(),Bitmap.Config.ARGB_8888)
    try { val canvas = Canvas(output); canvas.drawColor(Color.WHITE); var y = 0
      uris.forEachIndexed { i, uri -> val bitmap = read(Uri.parse(uri),1400); try { canvas.drawBitmap(bitmap,null,Rect(0,y,width,y+heights[i]),Paint(Paint.FILTER_BITMAP_FLAG)); y += heights[i] } finally { bitmap.recycle() } }
      return save(output)["uri"] as String
    } finally { output.recycle() }
  }
  private fun xml(text: String) = text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").filter { it >= ' ' || it == '\n' || it == '\t' }
  private fun exportWord(uris: List<String>): String {
    val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
    val target = file("docx")
    try {
      ZipOutputStream(target.outputStream()).use { zip ->
        fun entry(name: String, value: String) { zip.putNextEntry(ZipEntry(name)); zip.write(value.toByteArray(Charsets.UTF_8)); zip.closeEntry() }
        entry("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>""")
        entry("_rels/.rels", """<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>""")
        val body = StringBuilder(); val relationships = StringBuilder()
        uris.forEachIndexed { i, uri ->
          val bitmap = read(Uri.parse(uri))
          try {
            val result = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap,0)),60,TimeUnit.SECONDS)
            if (i > 0) body.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>")
            body.append("<w:p><w:r><w:t>第 ${i+1} 页 · 识别文字</w:t></w:r></w:p>")
            val lines = result.textBlocks.flatMap { it.lines }.map { it.text }
            if (lines.isEmpty()) body.append("<w:p><w:r><w:t>本页未识别到文字，请查看下方原始扫描图。</w:t></w:r></w:p>")
            lines.forEach { body.append("<w:p><w:r><w:t xml:space=\"preserve\">${xml(it)}</w:t></w:r></w:p>") }
            val scale = min(5486400.0 / bitmap.width, 7500000.0 / bitmap.height)
            val cx = (bitmap.width * scale).toLong(); val cy = (bitmap.height * scale).toLong()
            body.append("""<w:p><w:r><w:drawing><wp:inline><wp:extent cx="$cx" cy="$cy"/><wp:docPr id="${i+1}" name="扫描页${i+1}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i+1}" name="page${i+1}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="img${i+1}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$cx" cy="$cy"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>""")
            relationships.append("""<Relationship Id="img${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i+1}.jpg"/>""")
            zip.putNextEntry(ZipEntry("word/media/page${i+1}.jpg")); bitmap.compress(Bitmap.CompressFormat.JPEG,92,zip); zip.closeEntry()
          } finally { bitmap.recycle() }
        }
        entry("word/_rels/document.xml.rels", """<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">$relationships</Relationships>""")
        entry("word/document.xml", """<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>$body<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>""")
      }
      return Uri.fromFile(target).toString()
    } catch(e: Exception) { target.delete(); throw e } finally { recognizer.close() }
  }
}
