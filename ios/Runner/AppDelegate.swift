import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "CardCenteringImageSaver") {
      ImageSaver.register(messenger: registrar.messenger())
    }
  }
}

/// 结果图：打开系统分享面板，用户可选“存储图像”保存到相册，或发给别人。
/// 这样不需要相册读取权限。
enum ImageSaver {
  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "card_centering/image_saver", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "saveImage" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let args = call.arguments as? [String: Any],
        let data = args["bytes"] as? FlutterStandardTypedData,
        let image = UIImage(data: data.data)
      else {
        result(FlutterError(code: "bad_args", message: "No image bytes", details: nil))
        return
      }
      guard let root = topViewController() else {
        result(FlutterError(code: "failed", message: "No view controller", details: nil))
        return
      }
      let sheet = UIActivityViewController(activityItems: [image], applicationActivities: nil)
      sheet.completionWithItemsHandler = { activity, completed, _, _ in
        if !completed {
          result("cancelled")
        } else if activity == .saveToCameraRoll {
          result("saved")
        } else {
          result("shared")
        }
      }
      if let popover = sheet.popoverPresentationController {
        popover.sourceView = root.view
        popover.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.midY, width: 0, height: 0)
        popover.permittedArrowDirections = []
      }
      root.present(sheet, animated: true)
    }
  }

  private static func topViewController() -> UIViewController? {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    var top = window?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}
