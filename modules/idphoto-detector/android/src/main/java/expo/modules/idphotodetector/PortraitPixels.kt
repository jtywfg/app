package expo.modules.idphotodetector

import android.graphics.Color
import kotlin.math.*

/** Linear-time guided matte refinement. Never blur across strong source-image edges. */
internal object PortraitPixels {
  fun mean(input: FloatArray, w: Int, h: Int, r: Int): FloatArray {
    val tmp = FloatArray(input.size); val out = FloatArray(input.size)
    for (y in 0 until h) {
      var sum = 0f
      for (x in 0 until min(w, r + 1)) sum += input[y*w+x]
      for (x in 0 until w) {
        tmp[y*w+x] = sum / (min(w-1,x+r)-max(0,x-r)+1)
        if (x-r >= 0) sum -= input[y*w+x-r]
        if (x+r+1 < w) sum += input[y*w+x+r+1]
      }
    }
    for (x in 0 until w) {
      var sum = 0f
      for (y in 0 until min(h,r+1)) sum += tmp[y*w+x]
      for (y in 0 until h) {
        out[y*w+x] = sum / (min(h-1,y+r)-max(0,y-r)+1)
        if (y-r >= 0) sum -= tmp[(y-r)*w+x]
        if (y+r+1 < h) sum += tmp[(y+r+1)*w+x]
      }
    }
    return out
  }
  fun matte(pixels: IntArray, mask: FloatArray, w: Int, h: Int): FloatArray {
    val gray = FloatArray(pixels.size) { (Color.red(pixels[it])*.299f+Color.green(pixels[it])*.587f+Color.blue(pixels[it])*.114f)/255 }
    val radius = max(2, min(w,h)/120)
    val mi = mean(gray,w,h,radius); val mp = mean(mask,w,h,radius)
    val ii = mean(FloatArray(gray.size) { gray[it]*gray[it] },w,h,radius)
    val ip = mean(FloatArray(gray.size) { gray[it]*mask[it] },w,h,radius)
    val a = FloatArray(gray.size) { (ip[it]-mi[it]*mp[it])/(max(0f,ii[it]-mi[it]*mi[it])+.0015f) }
    val b = FloatArray(gray.size) { mp[it]-a[it]*mi[it] }
    val ma = mean(a,w,h,radius); val mb = mean(b,w,h,radius)
    return FloatArray(gray.size) { val t = ((ma[it]*gray[it]+mb[it]-.20f)/.65f).coerceIn(0f,1f); t*t*(3-2*t) }
  }
  /** Estimate clean nearby foreground colour to suppress old-background spill. */
  fun edgeColor(pixels: IntArray, mask: FloatArray, w: Int, h: Int, x: Int, y: Int, alpha: Float): Int {
    if (alpha <= .02f || alpha >= .98f) return pixels[y*w+x]
    val radius = max(3,min(w,h)/80)
    var nearest = Int.MAX_VALUE; var clean = pixels[y*w+x]
    for (dy in -radius..radius step 2) for (dx in -radius..radius step 2) {
      val xx=x+dx; val yy=y+dy; val distance=dx*dx+dy*dy
      if (xx in 0 until w && yy in 0 until h && distance < nearest && mask[yy*w+xx]>.98f) { nearest=distance; clean=pixels[yy*w+xx] }
    }
    val original=pixels[y*w+x]; val mix=(1-alpha)*.75f
    return Color.rgb((Color.red(original)*(1-mix)+Color.red(clean)*mix).roundToInt(),(Color.green(original)*(1-mix)+Color.green(clean)*mix).roundToInt(),(Color.blue(original)*(1-mix)+Color.blue(clean)*mix).roundToInt())
  }
}
