import UIKit
import Capacitor
import WebKit

fileprivate extension UIColor {
    // Dark mode — matches CSS radial-gradient midpoint (#1A1F3A at 38%)
    static let himBg = UIColor(red: 26 / 255.0, green: 31 / 255.0, blue: 58 / 255.0, alpha: 1)
    static let himBg2 = UIColor(red: 21 / 255.0, green: 26 / 255.0, blue: 48 / 255.0, alpha: 1)
    static let himBg3 = UIColor(red: 15 / 255.0, green: 20 / 255.0, blue: 36 / 255.0, alpha: 1)
    static let himText = UIColor(red: 247 / 255.0, green: 240 / 255.0, blue: 232 / 255.0, alpha: 1)
    static let himMuted = UIColor(red: 156 / 255.0, green: 142 / 255.0, blue: 130 / 255.0, alpha: 1)
    // Light mode — matches CSS radial-gradient midpoint (#F5F1E8 at 38%)
    static let himLightBg = UIColor(red: 245 / 255.0, green: 241 / 255.0, blue: 232 / 255.0, alpha: 1)
    static let himLightBg2 = UIColor(red: 237 / 255.0, green: 231 / 255.0, blue: 217 / 255.0, alpha: 1)
    static let himLightText = UIColor(red: 26 / 255, green: 26 / 255, blue: 26 / 255, alpha: 1)
    static let himLightMuted = UIColor(red: 107 / 255, green: 107 / 255, blue: 107 / 255, alpha: 1)
    // Brand: primary accent. Mirrors `--chiraag` (#E8A23A) in src/app/globals.css.
    static let himChiraag = UIColor(red: 232 / 255, green: 162 / 255, blue: 58 / 255, alpha: 1)
    static let himGold = UIColor(red: 212 / 255, green: 150 / 255, blue: 58 / 255, alpha: 1)
    static let himGreen = UIColor(red: 78 / 255, green: 201 / 255, blue: 122 / 255, alpha: 1)
    static let himLavender = UIColor(red: 167 / 255, green: 139 / 255, blue: 250 / 255, alpha: 1)
    static let himOffline = UIColor(red: 122 / 255, green: 115 / 255, blue: 108 / 255, alpha: 1)
}
fileprivate func resolveSignedPushEnvironment() -> String? {
    if let debugValue = Bundle.main.object(forInfoDictionaryKey: "CAPACITOR_DEBUG") as? String,
       ["1", "true", "yes"].contains(debugValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) {
        return "sandbox"
    }

    return "production"
}

@objc(HiItsMeBridgeViewController)
class HiItsMeBridgeViewController: CAPBridgeViewController {
    private var hasInstalledMediaTrackingScript = false
    private let mediaTrackingScript = #"""
        (() => {
            if (window.__himMediaCleanupInstalled) {
                return;
            }

            const registry = new Set();
            const safeCall = (fn) => {
                try {
                    fn();
                } catch {}
            };

            const cleanElement = (element, removeFromRegistry = true) => {
                if (!element) {
                    return;
                }

                safeCall(() => element.pause());
                safeCall(() => {
                    if ("srcObject" in element) {
                        element.srcObject = null;
                    }
                });
                safeCall(() => element.removeAttribute("src"));
                safeCall(() => {
                    while (element.firstChild) {
                        element.removeChild(element.firstChild);
                    }
                });
                safeCall(() => element.load());

                if (removeFromRegistry) {
                    registry.delete(element);
                }
            };

            const trackElement = (element) => {
                if (!element || registry.has(element)) {
                    return element;
                }

                safeCall(() => {
                    element.disableRemotePlayback = true;
                    element.playsInline = true;
                });

                registry.add(element);

                const release = () => cleanElement(element);
                safeCall(() => element.addEventListener("ended", release, { once: true }));
                safeCall(() => element.addEventListener("error", release, { once: true }));

                return element;
            };

            const cleanupAll = () => {
                document.querySelectorAll("audio, video").forEach(trackElement);
                Array.from(registry).forEach((element) => cleanElement(element));
                return registry.size;
            };

            const NativeAudio = window.Audio;
            if (typeof NativeAudio === "function") {
                const WrappedAudio = function (...args) {
                    return trackElement(new NativeAudio(...args));
                };
                WrappedAudio.prototype = NativeAudio.prototype;
                Object.setPrototypeOf(WrappedAudio, NativeAudio);
                window.Audio = WrappedAudio;
            }

            const nativePlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (...args) {
                trackElement(this);
                return nativePlay.apply(this, args);
            };

            window.__himMediaCleanupInstalled = true;
            window.__himTrackedMediaElements = registry;
            window.__himCleanupMediaElements = cleanupAll;

            ["pagehide", "beforeunload", "unload"].forEach((eventName) => {
                window.addEventListener(eventName, cleanupAll, { passive: true });
            });
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "hidden") {
                    cleanupAll();
                }
            }, { passive: true });
        })();
        """#
    private let mediaTeardownScript = """
        (() => {
            if (typeof window.__himCleanupMediaElements === "function") {
                return window.__himCleanupMediaElements();
            }

            const mediaElements = Array.from(document.querySelectorAll("audio, video"));
            for (const element of mediaElements) {
                try { element.pause(); } catch {}
                try {
                    if ("srcObject" in element) {
                        element.srcObject = null;
                    }
                } catch {}
                try { element.removeAttribute("src"); } catch {}
                try {
                    while (element.firstChild) {
                        element.removeChild(element.firstChild);
                    }
                } catch {}
                try { element.load(); } catch {}
            }
            return mediaElements.length;
        })();
        """

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(HiItsMeShellPlugin.self)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.backgroundColor = .clear
        webView?.isOpaque = false
        installMediaTrackingIfNeeded()
    }

    func prepareForMediaShutdown() {
        guard let webView else {
            return
        }

        installMediaTrackingIfNeeded()
        webView.evaluateJavaScript(mediaTeardownScript, completionHandler: nil)
    }

    func tearDownWebView() {
        guard let webView else {
            return
        }

        prepareForMediaShutdown()
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.scrollView.delegate = nil
    }

    private func installMediaTrackingIfNeeded() {
        guard !hasInstalledMediaTrackingScript, let webView else {
            return
        }

        hasInstalledMediaTrackingScript = true
        let contentController = webView.configuration.userContentController
        let userScript = WKUserScript(source: mediaTrackingScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        contentController.addUserScript(userScript)
        webView.evaluateJavaScript(mediaTrackingScript, completionHandler: nil)
    }

    deinit {
        tearDownWebView()
    }
}


@objc(HiItsMeShellPlugin)
class HiItsMeShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HiItsMeShellPlugin"
    public let jsName = "HiItsMeShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPushEnvironment", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        // The React app owns the entire visible experience on iOS. This plugin
        // stays registered for native services (the signed push environment),
        // but always reports the presentation shell unavailable so the web
        // renders its own chrome and content instead of a native duplicate.
        call.resolve([
            "available": false,
            "platform": "ios"
        ])
    }

    @objc func getPushEnvironment(_ call: CAPPluginCall) {
        var payload: JSObject = [:]
        payload["environment"] = resolveSignedPushEnvironment() ?? NSNull()
        call.resolve(payload)
    }
}

// Thin host for the Capacitor bridge. Main.storyboard instantiates this class
// by name, so it stays even though it no longer draws anything of its own: the
// web view runs edge-to-edge and the React app supplies every pixel above it.
@objc(HiItsMeShellViewController)
class HiItsMeShellViewController: UIViewController {
    private let bridgeViewController = HiItsMeBridgeViewController()
    private var hasPreparedBridgeForShutdown = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .himBg
        embedBridgeViewController()
        registerForApplicationLifecycleNotifications()
    }

    // This tracked the published chrome state, whose `isDark` defaulted to true
    // and is no longer published at all — so this is the value it already
    // resolved to on every launch.
    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        prepareBridgeForShutdown()
    }

    private func embedBridgeViewController() {
        addChild(bridgeViewController)
        bridgeViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(bridgeViewController.view, at: 0)

        NSLayoutConstraint.activate([
            bridgeViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        bridgeViewController.didMove(toParent: self)
    }

    private func registerForApplicationLifecycleNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleApplicationWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleApplicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleApplicationWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
    }

    @objc private func handleApplicationWillResignActive() {
        bridgeViewController.prepareForMediaShutdown()
    }

    @objc private func handleApplicationDidEnterBackground() {
        bridgeViewController.prepareForMediaShutdown()
    }

    @objc private func handleApplicationWillTerminate() {
        prepareBridgeForShutdown()
    }

    fileprivate func prepareBridgeForShutdown() {
        guard !hasPreparedBridgeForShutdown else {
            return
        }

        hasPreparedBridgeForShutdown = true
        bridgeViewController.tearDownWebView()
    }

    fileprivate func prepareMediaForBackground() {
        bridgeViewController.prepareForMediaShutdown()
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    // Scenes own the real window; this app supports exactly one, so surface
    // it here too since applicationDidEnterBackground/applicationWillTerminate
    // below still read `window` directly.
    var window: UIWindow? {
        get {
            UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow }
                .first
        }
        set {}
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        (window?.rootViewController as? HiItsMeShellViewController)?.prepareMediaForBackground()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
        (window?.rootViewController as? HiItsMeShellViewController)?.prepareBridgeForShutdown()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
