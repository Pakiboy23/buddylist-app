import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    private func shellController(for scene: UIScene? = nil) -> HiItsMeShellViewController? {
        if let shellController = window?.rootViewController as? HiItsMeShellViewController {
            return shellController
        }

        return (scene as? UIWindowScene)?
            .windows
            .first { $0.isKeyWindow }?
            .rootViewController as? HiItsMeShellViewController
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .annotation: context.options.annotation,
                .openInPlace: context.options.openInPlace,
            ]
            if let sourceApplication = context.options.sourceApplication {
                options[.sourceApplication] = sourceApplication
            }
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: context.url,
                options: options
            )
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }

    func sceneWillResignActive(_ scene: UIScene) {
        shellController(for: scene)?.prepareMediaForBackground()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        shellController(for: scene)?.prepareMediaForBackground()
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        shellController(for: scene)?.prepareBridgeForShutdown()
    }
}
