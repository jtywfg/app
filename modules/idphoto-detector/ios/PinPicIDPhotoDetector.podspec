Pod::Spec.new do |s|
  s.name           = 'PinPicIDPhotoDetector'
  s.version        = '1.0.0'
  s.summary        = 'On-device face checks and ID photo background replacement for PinPic'
  s.description    = s.summary
  s.license        = { :type => 'MIT' }
  s.author         = 'PinPic'
  s.homepage       = 'https://example.invalid/pinpic'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO', 'CoreGraphics', 'CoreImage', 'CoreVideo'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
