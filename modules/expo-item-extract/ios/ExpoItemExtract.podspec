require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoItemExtract'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'MIT' }
  s.author         = 'MIEN'
  s.homepage       = 'https://github.com/BuiXuanKhoi/true-clothes'
  s.platform       = :ios, '15.1'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'

  # Vision is a system framework — no pod needed.
  s.frameworks = 'Vision', 'CoreImage', 'UIKit'

  # Swift version
  s.swift_version = '5.9'
end
