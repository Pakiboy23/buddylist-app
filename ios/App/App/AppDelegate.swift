import UIKit
import Capacitor
import WebKit

fileprivate enum BuddyListShellTab: String, Decodable {
    case im
    case chat
    case buddy
    case profile
}

fileprivate enum BuddyListShellAction: String {
    case toggleTheme
    case openSaved
    case openAdd
    case openMenu
    case openPrivacy
    case openAdminReset
    case signOff
    case goBack
}

fileprivate struct BuddyListShellChromeState: Decodable, Equatable {
    let title: String
    let subtitle: String?
    let activeTab: BuddyListShellTab
    let canGoBack: Bool
    let isDark: Bool
    let isAdminUser: Bool
    let unreadDirectCount: Int

    init(
        title: String = "Buddy List",
        subtitle: String? = "Private messaging for buddies",
        activeTab: BuddyListShellTab = .im,
        canGoBack: Bool = false,
        isDark: Bool = false,
        isAdminUser: Bool = false,
        unreadDirectCount: Int = 0
    ) {
        self.title = title
        self.subtitle = subtitle
        self.activeTab = activeTab
        self.canGoBack = canGoBack
        self.isDark = isDark
        self.isAdminUser = isAdminUser
        self.unreadDirectCount = unreadDirectCount
    }

    private enum CodingKeys: String, CodingKey {
        case title
        case subtitle
        case activeTab
        case canGoBack
        case isDark
        case isAdminUser
        case unreadDirectCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Buddy List"

        let subtitleValue = try container.decodeIfPresent(String.self, forKey: .subtitle)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        subtitle = subtitleValue?.isEmpty == true ? nil : subtitleValue

        let activeTabValue = try container.decodeIfPresent(String.self, forKey: .activeTab) ?? BuddyListShellTab.im.rawValue
        activeTab = BuddyListShellTab(rawValue: activeTabValue) ?? .im
        canGoBack = try container.decodeIfPresent(Bool.self, forKey: .canGoBack) ?? false
        isDark = try container.decodeIfPresent(Bool.self, forKey: .isDark) ?? false
        isAdminUser = try container.decodeIfPresent(Bool.self, forKey: .isAdminUser) ?? false
        unreadDirectCount = max(0, try container.decodeIfPresent(Int.self, forKey: .unreadDirectCount) ?? 0)
    }
}

fileprivate enum NativePrivacyNotificationPreviewMode: String, Decodable {
    case full
    case nameOnly = "name_only"
    case hidden

    init(segmentIndex: Int) {
        switch segmentIndex {
        case 1:
            self = .nameOnly
        case 2:
            self = .hidden
        default:
            self = .full
        }
    }

    var segmentIndex: Int {
        switch self {
        case .full:
            return 0
        case .nameOnly:
            return 1
        case .hidden:
            return 2
        }
    }

    var detailText: String {
        switch self {
        case .full:
            return "Show the sender and message snippet in notification banners."
        case .nameOnly:
            return "Show the sender while hiding message text in banners."
        case .hidden:
            return "Keep notification banners generic with no message details."
        }
    }
}

fileprivate struct NativePrivacyState: Decodable {
    let shareReadReceipts: Bool
    let notificationPreviewMode: NativePrivacyNotificationPreviewMode
    let screenShieldEnabled: Bool
    let appLockEnabled: Bool
    let appLockTimeoutLabel: String
    let biometricsEnabled: Bool
    let biometricLabel: String?
    let blockedBuddyCount: Int

    private enum CodingKeys: String, CodingKey {
        case settings
        case appLockEnabled
        case appLockTimeoutLabel
        case biometricsEnabled
        case biometricLabel
        case blockedBuddyCount
    }

    private enum SettingsKeys: String, CodingKey {
        case shareReadReceipts
        case notificationPreviewMode
        case screenShieldEnabled
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let settingsContainer = try container.nestedContainer(keyedBy: SettingsKeys.self, forKey: .settings)

        shareReadReceipts = try settingsContainer.decodeIfPresent(Bool.self, forKey: .shareReadReceipts) ?? true
        notificationPreviewMode = try settingsContainer.decodeIfPresent(NativePrivacyNotificationPreviewMode.self, forKey: .notificationPreviewMode) ?? .full
        screenShieldEnabled = try settingsContainer.decodeIfPresent(Bool.self, forKey: .screenShieldEnabled) ?? false
        appLockEnabled = try container.decodeIfPresent(Bool.self, forKey: .appLockEnabled) ?? false
        appLockTimeoutLabel = try container.decodeIfPresent(String.self, forKey: .appLockTimeoutLabel) ?? "Immediately"
        biometricsEnabled = try container.decodeIfPresent(Bool.self, forKey: .biometricsEnabled) ?? false

        let biometricLabelValue = try container.decodeIfPresent(String.self, forKey: .biometricLabel)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        biometricLabel = biometricLabelValue?.isEmpty == true ? nil : biometricLabelValue
        blockedBuddyCount = max(0, try container.decodeIfPresent(Int.self, forKey: .blockedBuddyCount) ?? 0)
    }
}

fileprivate struct NativePrivacyResponse: Decodable {
    let ok: Bool
    let state: NativePrivacyState?
    let warning: String?
    let error: String?
}

fileprivate struct NativeAdminResetIssueResponse: Decodable {
    let ok: Bool
    let screenname: String?
    let ticket: String?
    let expiresAt: String?
    let handoff: String?
    let feedback: String?
    let error: String?
}

fileprivate struct NativeAdminResetAuditItem: Decodable {
    let id: Int
    let title: String
    let timestamp: String
    let actorLabel: String
    let targetLabel: String
    let reason: String?
}

fileprivate struct NativeAdminResetAuditResponse: Decodable {
    let ok: Bool
    let entries: [NativeAdminResetAuditItem]?
    let error: String?
}

fileprivate func makeShellError(_ message: String) -> NSError {
    NSError(domain: "BuddyListShell", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

@objc(BuddyListBridgeViewController)
class BuddyListBridgeViewController: CAPBridgeViewController {
    weak var shellController: BuddyListShellViewController?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(BuddyListShellPlugin.self)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.backgroundColor = .clear
        webView?.isOpaque = false
    }
}

@objc(BuddyListShellPlugin)
class BuddyListShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BuddyListShellPlugin"
    public let jsName = "BuddyListShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setChromeState", returnType: CAPPluginReturnPromise)
    ]

    private var shellController: BuddyListShellViewController? {
        (bridge?.viewController as? BuddyListBridgeViewController)?.shellController
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "platform": "ios"
        ])
    }

    @objc func setChromeState(_ call: CAPPluginCall) {
        guard let shellController else {
            call.unavailable("Native shell is not ready.")
            return
        }

        do {
            let state = try call.decode(BuddyListShellChromeState.self)
            DispatchQueue.main.async {
                shellController.applyChromeState(state)
                call.resolve()
            }
        } catch {
            call.reject("Invalid native shell state.", nil, error)
        }
    }
}

@objc(BuddyListShellViewController)
class BuddyListShellViewController: UIViewController, UITabBarDelegate {
    private let bridgeViewController = BuddyListBridgeViewController()
    private let topChromeView = UIVisualEffectView(effect: nil)
    private let bottomChromeView = UIVisualEffectView(effect: nil)
    private let navigationBar = UINavigationBar(frame: .zero)
    private let tabBar = UITabBar(frame: .zero)
    private let topNavigationItem = UINavigationItem(title: "")
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private lazy var titleStackView: UIStackView = {
        let stackView = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        stackView.axis = .vertical
        stackView.alignment = .center
        stackView.spacing = 1
        return stackView
    }()
    private lazy var imTabItem = UITabBarItem(
        title: "IM",
        image: UIImage(systemName: "message.fill"),
        selectedImage: UIImage(systemName: "message.fill")
    )
    private lazy var chatTabItem = UITabBarItem(
        title: "Chat",
        image: UIImage(systemName: "bubble.left.and.bubble.right.fill"),
        selectedImage: UIImage(systemName: "bubble.left.and.bubble.right.fill")
    )
    private lazy var buddyTabItem = UITabBarItem(
        title: "Buddy",
        image: UIImage(systemName: "person.badge.plus"),
        selectedImage: UIImage(systemName: "person.badge.plus.fill")
    )
    private lazy var profileTabItem = UITabBarItem(
        title: "Profile",
        image: UIImage(systemName: "person.crop.circle"),
        selectedImage: UIImage(systemName: "person.crop.circle.fill")
    )
    private var chromeState = BuddyListShellChromeState()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        bridgeViewController.shellController = self

        configureTitleView()
        configureNavigationBar()
        configureTabBar()
        embedBridgeViewController()
        applyChromeState(chromeState, animated: false)
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        chromeState.isDark ? .lightContent : .darkContent
    }

    fileprivate func applyChromeState(_ state: BuddyListShellChromeState, animated: Bool = true) {
        chromeState = state
        overrideUserInterfaceStyle = state.isDark ? .dark : .light
        view.backgroundColor = state.isDark ? UIColor.black : UIColor.systemBackground

        titleLabel.text = state.title
        subtitleLabel.text = state.subtitle
        subtitleLabel.isHidden = state.subtitle == nil

        updateNavigationItems()
        updateTabSelection()
        updateChromeAppearance(animated: animated)
        setNeedsStatusBarAppearanceUpdate()
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        switch item {
        case imTabItem:
            dispatchCommand(type: "selectTab", valueKey: "tab", value: BuddyListShellTab.im.rawValue)
        case chatTabItem:
            dispatchCommand(type: "selectTab", valueKey: "tab", value: BuddyListShellTab.chat.rawValue)
        case buddyTabItem:
            dispatchCommand(type: "selectTab", valueKey: "tab", value: BuddyListShellTab.buddy.rawValue)
        case profileTabItem:
            dispatchCommand(type: "selectTab", valueKey: "tab", value: BuddyListShellTab.profile.rawValue)
        default:
            return
        }
    }

    fileprivate func presentAdminResetSheet() {
        if presentedViewController != nil {
            return
        }

        let controller = AdminResetSheetViewController(shellController: self)
        let navigationController = UINavigationController(rootViewController: controller)
        navigationController.modalPresentationStyle = .pageSheet
        navigationController.overrideUserInterfaceStyle = chromeState.isDark ? .dark : .light

        if let sheet = navigationController.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 30
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }

        present(navigationController, animated: true)
    }

    fileprivate func presentPrivacySheet() {
        if presentedViewController != nil {
            return
        }

        let controller = PrivacySheetViewController(shellController: self)
        let navigationController = UINavigationController(rootViewController: controller)
        navigationController.modalPresentationStyle = .pageSheet
        navigationController.overrideUserInterfaceStyle = chromeState.isDark ? .dark : .light

        if let sheet = navigationController.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 30
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }

        present(navigationController, animated: true)
    }

    fileprivate func loadPrivacyState(completion: @escaping (Result<NativePrivacyResponse, Error>) -> Void) {
        callBridgeMethod(
            """
            if (!window.__buddyListNativeShell?.loadPrivacyState) {
                return { ok: false, error: "Privacy bridge unavailable." };
            }
            return await window.__buddyListNativeShell.loadPrivacyState();
            """,
            arguments: [:],
            as: NativePrivacyResponse.self,
            completion: completion
        )
    }

    fileprivate func updatePrivacySettings(
        patch: [String: Any],
        completion: @escaping (Result<NativePrivacyResponse, Error>) -> Void
    ) {
        callBridgeMethod(
            """
            if (!window.__buddyListNativeShell?.updatePrivacySettings) {
                return { ok: false, error: "Privacy bridge unavailable." };
            }
            return await window.__buddyListNativeShell.updatePrivacySettings(patch);
            """,
            arguments: ["patch": patch],
            as: NativePrivacyResponse.self,
            completion: completion
        )
    }

    fileprivate func loadAdminResetAudit(limit: Int = 12, completion: @escaping (Result<[NativeAdminResetAuditItem], Error>) -> Void) {
        callBridgeMethod(
            """
            if (!window.__buddyListNativeShell?.loadAdminResetAudit) {
                return { ok: false, error: "Admin reset bridge unavailable." };
            }
            return await window.__buddyListNativeShell.loadAdminResetAudit(limit);
            """,
            arguments: ["limit": limit],
            as: NativeAdminResetAuditResponse.self
        ) { result in
            switch result {
            case .success(let response):
                if response.ok, let entries = response.entries {
                    completion(.success(entries))
                } else {
                    completion(.failure(makeShellError(response.error ?? "Could not load recovery activity.")))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    fileprivate func openWebPrivacyControls() {
        dispatchAction(.openPrivacy)
    }

    fileprivate func issueAdminResetTicket(
        screenname: String,
        completion: @escaping (Result<NativeAdminResetIssueResponse, Error>) -> Void
    ) {
        callBridgeMethod(
            """
            if (!window.__buddyListNativeShell?.issueAdminResetTicket) {
                return { ok: false, error: "Admin reset bridge unavailable." };
            }
            return await window.__buddyListNativeShell.issueAdminResetTicket(screenname);
            """,
            arguments: ["screenname": screenname],
            as: NativeAdminResetIssueResponse.self
        ) { result in
            switch result {
            case .success(let response):
                if response.ok {
                    completion(.success(response))
                } else {
                    completion(.failure(makeShellError(response.error ?? "Could not issue reset ticket.")))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    private func callBridgeMethod<T: Decodable>(
        _ script: String,
        arguments: [String: Any],
        as type: T.Type,
        completion: @escaping (Result<T, Error>) -> Void
    ) {
        guard let webView = bridgeViewController.webView else {
            completion(.failure(makeShellError("Buddy List is still loading.")))
            return
        }

        webView.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                guard JSONSerialization.isValidJSONObject(value) else {
                    completion(.failure(makeShellError("Buddy List returned an unreadable response.")))
                    return
                }

                do {
                    let data = try JSONSerialization.data(withJSONObject: value)
                    let decoded = try JSONDecoder().decode(type, from: data)
                    completion(.success(decoded))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    private func configureTitleView() {
        titleLabel.font = UIFont.preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 1

        subtitleLabel.font = UIFont.preferredFont(forTextStyle: .caption1)
        subtitleLabel.adjustsFontForContentSizeCategory = true
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 1

        topNavigationItem.titleView = titleStackView
    }

    private func configureNavigationBar() {
        topChromeView.translatesAutoresizingMaskIntoConstraints = false
        navigationBar.translatesAutoresizingMaskIntoConstraints = false
        navigationBar.prefersLargeTitles = false
        navigationBar.setItems([topNavigationItem], animated: false)

        view.addSubview(topChromeView)
        topChromeView.contentView.addSubview(navigationBar)

        NSLayoutConstraint.activate([
            topChromeView.topAnchor.constraint(equalTo: view.topAnchor),
            topChromeView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topChromeView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            navigationBar.topAnchor.constraint(equalTo: topChromeView.safeAreaLayoutGuide.topAnchor),
            navigationBar.leadingAnchor.constraint(equalTo: topChromeView.contentView.leadingAnchor),
            navigationBar.trailingAnchor.constraint(equalTo: topChromeView.contentView.trailingAnchor),
            navigationBar.bottomAnchor.constraint(equalTo: topChromeView.contentView.bottomAnchor)
        ])
    }

    private func configureTabBar() {
        bottomChromeView.translatesAutoresizingMaskIntoConstraints = false
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.items = [imTabItem, chatTabItem, buddyTabItem, profileTabItem]
        tabBar.selectedItem = imTabItem

        view.addSubview(bottomChromeView)
        bottomChromeView.contentView.addSubview(tabBar)

        NSLayoutConstraint.activate([
            bottomChromeView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomChromeView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomChromeView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            tabBar.topAnchor.constraint(equalTo: bottomChromeView.contentView.topAnchor),
            tabBar.leadingAnchor.constraint(equalTo: bottomChromeView.contentView.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: bottomChromeView.contentView.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: bottomChromeView.safeAreaLayoutGuide.bottomAnchor)
        ])
    }

    private func embedBridgeViewController() {
        addChild(bridgeViewController)
        bridgeViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeViewController.view)

        NSLayoutConstraint.activate([
            bridgeViewController.view.topAnchor.constraint(equalTo: topChromeView.bottomAnchor),
            bridgeViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeViewController.view.bottomAnchor.constraint(equalTo: bottomChromeView.topAnchor)
        ])

        bridgeViewController.didMove(toParent: self)
    }

    private func updateNavigationItems() {
        topNavigationItem.leftBarButtonItem = chromeState.canGoBack
            ? makeBarButtonItem(
                systemName: "chevron.backward",
                accessibilityLabel: "Back",
                action: #selector(handleGoBack)
            )
            : nil

        let themeIcon = chromeState.isDark ? "sun.max.fill" : "moon.fill"
        let themeLabel = chromeState.isDark ? "Switch to light mode" : "Switch to dark mode"

        let themeItem = makeBarButtonItem(
            systemName: themeIcon,
            accessibilityLabel: themeLabel,
            action: #selector(handleToggleTheme)
        )
        let savedItem = makeBarButtonItem(
            systemName: "bookmark.fill",
            accessibilityLabel: "Open saved messages",
            action: #selector(handleOpenSaved)
        )
        let addItem = makeBarButtonItem(
            systemName: "person.badge.plus",
            accessibilityLabel: "Add a buddy",
            action: #selector(handleOpenAdd)
        )
        let menuItem = UIBarButtonItem(
            image: UIImage(systemName: "ellipsis.circle"),
            primaryAction: nil,
            menu: makeOverflowMenu()
        )
        menuItem.accessibilityLabel = "More options"

        topNavigationItem.rightBarButtonItems = [menuItem, addItem, savedItem, themeItem]
    }

    private func updateTabSelection() {
        switch chromeState.activeTab {
        case .im:
            tabBar.selectedItem = imTabItem
        case .chat:
            tabBar.selectedItem = chatTabItem
        case .buddy:
            tabBar.selectedItem = buddyTabItem
        case .profile:
            tabBar.selectedItem = profileTabItem
        }

        imTabItem.badgeValue = chromeState.unreadDirectCount > 0
            ? (chromeState.unreadDirectCount > 99 ? "99+" : String(chromeState.unreadDirectCount))
            : nil
        imTabItem.badgeColor = .systemRed
    }

    private func updateChromeAppearance(animated: Bool) {
        let blurStyle: UIBlurEffect.Style = chromeState.isDark ? .systemChromeMaterialDark : .systemChromeMaterialLight
        let tintColor = UIColor.systemBlue
        let titleColor = chromeState.isDark ? UIColor.white : UIColor.label
        let subtitleColor = chromeState.isDark
            ? UIColor.secondaryLabel.withAlphaComponent(0.92)
            : UIColor.secondaryLabel
        let navBackground = (chromeState.isDark ? UIColor.black : UIColor.white).withAlphaComponent(0.16)
        let tabBackground = (chromeState.isDark ? UIColor.black : UIColor.white).withAlphaComponent(0.18)
        let animationBlock = {
            self.topChromeView.effect = UIBlurEffect(style: blurStyle)
            self.bottomChromeView.effect = UIBlurEffect(style: blurStyle)
            self.topChromeView.contentView.backgroundColor = navBackground
            self.bottomChromeView.contentView.backgroundColor = tabBackground
            self.titleLabel.textColor = titleColor
            self.subtitleLabel.textColor = subtitleColor
            self.navigationBar.tintColor = tintColor
            self.tabBar.tintColor = tintColor
            self.tabBar.unselectedItemTintColor = subtitleColor
            self.applyNavigationAppearance()
            self.applyTabBarAppearance()
        }

        if animated {
            UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseInOut, .beginFromCurrentState], animations: animationBlock)
        } else {
            animationBlock()
        }
    }

    private func applyNavigationAppearance() {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = nil
        appearance.backgroundColor = .clear
        appearance.shadowColor = UIColor.separator.withAlphaComponent(chromeState.isDark ? 0.18 : 0.12)

        navigationBar.standardAppearance = appearance
        navigationBar.compactAppearance = appearance
        navigationBar.scrollEdgeAppearance = appearance
    }

    private func applyTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = nil
        appearance.backgroundColor = .clear
        appearance.shadowColor = UIColor.separator.withAlphaComponent(chromeState.isDark ? 0.16 : 0.1)

        let normalColor = chromeState.isDark
            ? UIColor.secondaryLabel.withAlphaComponent(0.92)
            : UIColor.secondaryLabel
        let selectedColor = UIColor.systemBlue

        appearance.stackedLayoutAppearance.normal.iconColor = normalColor
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: normalColor]
        appearance.stackedLayoutAppearance.selected.iconColor = selectedColor
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: selectedColor]

        tabBar.standardAppearance = appearance
        tabBar.scrollEdgeAppearance = appearance
    }

    private func makeBarButtonItem(systemName: String, accessibilityLabel: String, action: Selector) -> UIBarButtonItem {
        let buttonItem = UIBarButtonItem(
            image: UIImage(systemName: systemName),
            style: .plain,
            target: self,
            action: action
        )
        buttonItem.accessibilityLabel = accessibilityLabel
        return buttonItem
    }

    private func makeOverflowMenu() -> UIMenu {
        var actions: [UIAction] = [
            UIAction(title: "Privacy", image: UIImage(systemName: "hand.raised.fill")) { [weak self] _ in
                self?.presentPrivacySheet()
            }
        ]

        if chromeState.isAdminUser {
            actions.append(
                UIAction(title: "Reset Access", image: UIImage(systemName: "shield.lefthalf.filled")) { [weak self] _ in
                    self?.presentAdminResetSheet()
                }
            )
        }

        actions.append(
            UIAction(
                title: "Sign Off",
                image: UIImage(systemName: "rectangle.portrait.and.arrow.right"),
                attributes: .destructive
            ) { [weak self] _ in
                self?.dispatchAction(.signOff)
            }
        )

        return UIMenu(title: "", children: actions)
    }

    private func dispatchAction(_ action: BuddyListShellAction) {
        dispatchCommand(type: "triggerAction", valueKey: "action", value: action.rawValue)
    }

    private func dispatchCommand(type: String, valueKey: String, value: String) {
        guard let webView = bridgeViewController.webView else {
            return
        }

        let payload: [String: String] = [
            "type": type,
            valueKey: value
        ]

        guard
            let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }

        let script = """
        window.dispatchEvent(new CustomEvent('buddylist:native-shell-command', { detail: \(json) }));
        """

        webView.evaluateJavaScript(script) { _, error in
            if let error {
                CAPLog.print("Native shell command dispatch failed: \(error.localizedDescription)")
            }
        }
    }

    @objc private func handleGoBack() {
        if presentedViewController != nil {
            dismiss(animated: true)
            return
        }

        dispatchAction(.goBack)
    }

    @objc private func handleToggleTheme() {
        dispatchAction(.toggleTheme)
    }

    @objc private func handleOpenSaved() {
        dispatchAction(.openSaved)
    }

    @objc private func handleOpenAdd() {
        dispatchAction(.openAdd)
    }
}

fileprivate final class PrivacySheetViewController: UIViewController {
    private weak var shellController: BuddyListShellViewController?

    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let loadSpinner = UIActivityIndicatorView(style: .medium)
    private let feedbackLabel = UILabel()
    private let shareReadReceiptsSwitch = UISwitch()
    private let notificationPreviewControl = UISegmentedControl(items: ["Full", "Sender", "Hidden"])
    private let notificationPreviewDetailLabel = UILabel()
    private let screenShieldSwitch = UISwitch()
    private let advancedSummaryLabel = UILabel()
    private let openAdvancedButton = UIButton(type: .system)

    private lazy var refreshItem = UIBarButtonItem(
        barButtonSystemItem: .refresh,
        target: self,
        action: #selector(handleRefresh)
    )

    private var currentState: NativePrivacyState?
    private var isLoadingState = false
    private var isSavingState = false

    init(shellController: BuddyListShellViewController) {
        self.shellController = shellController
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        title = "Privacy"
        navigationItem.leftBarButtonItem = refreshItem
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(handleClose)
        )

        configureScrollView()
        configureContent()
        updateInteractivity()
        loadPrivacyState()
    }

    private func configureScrollView() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 16

        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])
    }

    private func configureContent() {
        let heroCard = makeCardView()
        let heroIcon = UIImageView(image: UIImage(systemName: "hand.raised.fill"))
        heroIcon.translatesAutoresizingMaskIntoConstraints = false
        heroIcon.tintColor = .systemBlue
        heroIcon.preferredSymbolConfiguration = .init(pointSize: 20, weight: .semibold)
        heroIcon.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.12)
        heroIcon.layer.cornerRadius = 22
        heroIcon.clipsToBounds = true

        let heroTitle = makeLabel(textStyle: .headline, weight: .semibold)
        heroTitle.text = "Private by default"
        let heroBody = makeLabel(textStyle: .subheadline)
        heroBody.text = "Tune the essentials here, then jump into the full Buddy List controls for app lock and blocked members."
        heroBody.numberOfLines = 0
        heroBody.textColor = .secondaryLabel

        let heroTextStack = UIStackView(arrangedSubviews: [heroTitle, heroBody])
        heroTextStack.axis = .vertical
        heroTextStack.spacing = 6
        heroTextStack.translatesAutoresizingMaskIntoConstraints = false

        heroCard.addSubview(heroIcon)
        heroCard.addSubview(heroTextStack)

        NSLayoutConstraint.activate([
            heroIcon.leadingAnchor.constraint(equalTo: heroCard.leadingAnchor, constant: 18),
            heroIcon.topAnchor.constraint(equalTo: heroCard.topAnchor, constant: 18),
            heroIcon.widthAnchor.constraint(equalToConstant: 44),
            heroIcon.heightAnchor.constraint(equalToConstant: 44),

            heroTextStack.leadingAnchor.constraint(equalTo: heroIcon.trailingAnchor, constant: 14),
            heroTextStack.topAnchor.constraint(equalTo: heroCard.topAnchor, constant: 18),
            heroTextStack.trailingAnchor.constraint(equalTo: heroCard.trailingAnchor, constant: -18),
            heroTextStack.bottomAnchor.constraint(equalTo: heroCard.bottomAnchor, constant: -18)
        ])

        loadSpinner.hidesWhenStopped = true
        feedbackLabel.font = UIFont.preferredFont(forTextStyle: .subheadline)
        feedbackLabel.numberOfLines = 0
        feedbackLabel.isHidden = true

        let statusRow = UIStackView(arrangedSubviews: [loadSpinner, feedbackLabel])
        statusRow.axis = .horizontal
        statusRow.alignment = .center
        statusRow.spacing = 10

        let readReceiptsCard = makeCardView()
        let readReceiptsTitle = makeLabel(textStyle: .subheadline, weight: .semibold)
        readReceiptsTitle.text = "Share read receipts"
        let readReceiptsBody = makeLabel(textStyle: .caption1)
        readReceiptsBody.text = "Let buddies know when you have opened their messages."
        readReceiptsBody.numberOfLines = 0
        readReceiptsBody.textColor = .secondaryLabel

        let readReceiptsTextStack = UIStackView(arrangedSubviews: [readReceiptsTitle, readReceiptsBody])
        readReceiptsTextStack.axis = .vertical
        readReceiptsTextStack.spacing = 4

        let readReceiptsRow = UIStackView(arrangedSubviews: [readReceiptsTextStack, shareReadReceiptsSwitch])
        readReceiptsRow.axis = .horizontal
        readReceiptsRow.alignment = .center
        readReceiptsRow.spacing = 14
        readReceiptsRow.translatesAutoresizingMaskIntoConstraints = false
        shareReadReceiptsSwitch.addTarget(self, action: #selector(handleReadReceiptsChanged), for: .valueChanged)
        readReceiptsCard.addSubview(readReceiptsRow)

        NSLayoutConstraint.activate([
            readReceiptsRow.topAnchor.constraint(equalTo: readReceiptsCard.topAnchor, constant: 18),
            readReceiptsRow.leadingAnchor.constraint(equalTo: readReceiptsCard.leadingAnchor, constant: 18),
            readReceiptsRow.trailingAnchor.constraint(equalTo: readReceiptsCard.trailingAnchor, constant: -18),
            readReceiptsRow.bottomAnchor.constraint(equalTo: readReceiptsCard.bottomAnchor, constant: -18)
        ])

        let previewCard = makeCardView()
        let previewTitle = makeLabel(textStyle: .subheadline, weight: .semibold)
        previewTitle.text = "Notification previews"
        let previewBody = makeLabel(textStyle: .caption1)
        previewBody.text = "Choose how much detail appears in banners and lock-screen alerts."
        previewBody.numberOfLines = 0
        previewBody.textColor = .secondaryLabel

        notificationPreviewControl.selectedSegmentIndex = 0
        notificationPreviewControl.addTarget(self, action: #selector(handleNotificationPreviewChanged), for: .valueChanged)

        notificationPreviewDetailLabel.font = UIFont.preferredFont(forTextStyle: .caption1)
        notificationPreviewDetailLabel.textColor = .secondaryLabel
        notificationPreviewDetailLabel.numberOfLines = 0

        let previewStack = UIStackView(arrangedSubviews: [
            previewTitle,
            previewBody,
            notificationPreviewControl,
            notificationPreviewDetailLabel
        ])
        previewStack.axis = .vertical
        previewStack.spacing = 10
        previewStack.translatesAutoresizingMaskIntoConstraints = false
        previewCard.addSubview(previewStack)

        NSLayoutConstraint.activate([
            previewStack.topAnchor.constraint(equalTo: previewCard.topAnchor, constant: 18),
            previewStack.leadingAnchor.constraint(equalTo: previewCard.leadingAnchor, constant: 18),
            previewStack.trailingAnchor.constraint(equalTo: previewCard.trailingAnchor, constant: -18),
            previewStack.bottomAnchor.constraint(equalTo: previewCard.bottomAnchor, constant: -18)
        ])

        let screenShieldCard = makeCardView()
        let screenShieldTitle = makeLabel(textStyle: .subheadline, weight: .semibold)
        screenShieldTitle.text = "Screen shield"
        let screenShieldBody = makeLabel(textStyle: .caption1)
        screenShieldBody.text = "Obscure Buddy List when the app moves into the background."
        screenShieldBody.numberOfLines = 0
        screenShieldBody.textColor = .secondaryLabel

        let screenShieldTextStack = UIStackView(arrangedSubviews: [screenShieldTitle, screenShieldBody])
        screenShieldTextStack.axis = .vertical
        screenShieldTextStack.spacing = 4

        let screenShieldRow = UIStackView(arrangedSubviews: [screenShieldTextStack, screenShieldSwitch])
        screenShieldRow.axis = .horizontal
        screenShieldRow.alignment = .center
        screenShieldRow.spacing = 14
        screenShieldRow.translatesAutoresizingMaskIntoConstraints = false
        screenShieldSwitch.addTarget(self, action: #selector(handleScreenShieldChanged), for: .valueChanged)
        screenShieldCard.addSubview(screenShieldRow)

        NSLayoutConstraint.activate([
            screenShieldRow.topAnchor.constraint(equalTo: screenShieldCard.topAnchor, constant: 18),
            screenShieldRow.leadingAnchor.constraint(equalTo: screenShieldCard.leadingAnchor, constant: 18),
            screenShieldRow.trailingAnchor.constraint(equalTo: screenShieldCard.trailingAnchor, constant: -18),
            screenShieldRow.bottomAnchor.constraint(equalTo: screenShieldCard.bottomAnchor, constant: -18)
        ])

        let advancedCard = makeCardView()
        let advancedTitle = makeLabel(textStyle: .subheadline, weight: .semibold)
        advancedTitle.text = "Advanced security"
        let advancedBody = makeLabel(textStyle: .caption1)
        advancedBody.text = "App lock, biometric unlock, and blocked-buddy management still live in the full Buddy List privacy panel."
        advancedBody.numberOfLines = 0
        advancedBody.textColor = .secondaryLabel

        advancedSummaryLabel.font = UIFont.preferredFont(forTextStyle: .subheadline)
        advancedSummaryLabel.numberOfLines = 0
        advancedSummaryLabel.textColor = .label

        openAdvancedButton.configuration = .tinted()
        openAdvancedButton.configuration?.cornerStyle = .large
        openAdvancedButton.configuration?.title = "Open Full Controls"
        openAdvancedButton.configuration?.image = UIImage(systemName: "arrow.up.right.square")
        openAdvancedButton.configuration?.imagePadding = 8
        openAdvancedButton.addTarget(self, action: #selector(handleOpenAdvancedControls), for: .touchUpInside)

        let advancedStack = UIStackView(arrangedSubviews: [
            advancedTitle,
            advancedBody,
            advancedSummaryLabel,
            openAdvancedButton
        ])
        advancedStack.axis = .vertical
        advancedStack.spacing = 12
        advancedStack.translatesAutoresizingMaskIntoConstraints = false
        advancedCard.addSubview(advancedStack)

        NSLayoutConstraint.activate([
            advancedStack.topAnchor.constraint(equalTo: advancedCard.topAnchor, constant: 18),
            advancedStack.leadingAnchor.constraint(equalTo: advancedCard.leadingAnchor, constant: 18),
            advancedStack.trailingAnchor.constraint(equalTo: advancedCard.trailingAnchor, constant: -18),
            advancedStack.bottomAnchor.constraint(equalTo: advancedCard.bottomAnchor, constant: -18)
        ])

        contentStack.addArrangedSubview(heroCard)
        contentStack.addArrangedSubview(statusRow)
        contentStack.addArrangedSubview(readReceiptsCard)
        contentStack.addArrangedSubview(previewCard)
        contentStack.addArrangedSubview(screenShieldCard)
        contentStack.addArrangedSubview(advancedCard)
    }

    private func loadPrivacyState() {
        guard !isLoadingState else {
            return
        }

        guard let shellController else {
            showFeedback("Buddy List is still loading.", color: .systemRed)
            return
        }

        isLoadingState = true
        loadSpinner.startAnimating()
        updateInteractivity()

        shellController.loadPrivacyState { [weak self] result in
            DispatchQueue.main.async {
                guard let self else {
                    return
                }

                self.isLoadingState = false
                self.loadSpinner.stopAnimating()
                self.updateInteractivity()

                switch result {
                case .success(let response):
                    guard response.ok, let state = response.state else {
                        self.showFeedback(response.error ?? "Could not load privacy settings.", color: .systemRed)
                        return
                    }

                    self.applyState(state)
                    if let warning = response.warning, !warning.isEmpty {
                        self.showFeedback(warning, color: .systemOrange)
                    } else {
                        self.feedbackLabel.isHidden = true
                    }
                case .failure(let error):
                    self.showFeedback(error.localizedDescription, color: .systemRed)
                }
            }
        }
    }

    private func applyState(_ state: NativePrivacyState) {
        currentState = state
        shareReadReceiptsSwitch.isOn = state.shareReadReceipts
        screenShieldSwitch.isOn = state.screenShieldEnabled
        notificationPreviewControl.selectedSegmentIndex = state.notificationPreviewMode.segmentIndex
        notificationPreviewDetailLabel.text = state.notificationPreviewMode.detailText
        advancedSummaryLabel.text = makeAdvancedSummary(state)
        updateInteractivity()
    }

    private func makeAdvancedSummary(_ state: NativePrivacyState) -> String {
        let blockedSummary: String
        switch state.blockedBuddyCount {
        case 0:
            blockedSummary = "No blocked buddies."
        case 1:
            blockedSummary = "1 blocked buddy."
        default:
            blockedSummary = "\(state.blockedBuddyCount) blocked buddies."
        }

        let appLockSummary: String
        if state.appLockEnabled {
            var parts = ["App lock is on", "auto-lock \(state.appLockTimeoutLabel.lowercased())"]
            if state.biometricsEnabled, let biometricLabel = state.biometricLabel {
                parts.append("\(biometricLabel) unlock is on")
            }
            appLockSummary = parts.joined(separator: ", ") + "."
        } else {
            appLockSummary = "App lock is off on this device."
        }

        return "\(appLockSummary) \(blockedSummary)"
    }

    private func submitPatch(_ patch: [String: Any], previousState: NativePrivacyState) {
        guard !isSavingState else {
            return
        }

        guard let shellController else {
            applyState(previousState)
            showFeedback("Buddy List is still loading.", color: .systemRed)
            return
        }

        isSavingState = true
        updateInteractivity()
        showFeedback("Saving privacy updates...", color: .secondaryLabel)

        shellController.updatePrivacySettings(patch: patch) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else {
                    return
                }

                self.isSavingState = false
                self.updateInteractivity()

                switch result {
                case .success(let response):
                    guard response.ok, let state = response.state else {
                        self.applyState(previousState)
                        self.showFeedback(response.error ?? "Could not update privacy.", color: .systemRed)
                        return
                    }

                    self.applyState(state)
                    if let warning = response.warning, !warning.isEmpty {
                        self.showFeedback(warning, color: .systemOrange)
                    } else {
                        self.showFeedback("Privacy updated.", color: .systemGreen)
                    }
                case .failure(let error):
                    self.applyState(previousState)
                    self.showFeedback(error.localizedDescription, color: .systemRed)
                }
            }
        }
    }

    private func updateInteractivity() {
        let isInteractive = !isLoadingState && !isSavingState && currentState != nil
        shareReadReceiptsSwitch.isEnabled = isInteractive
        notificationPreviewControl.isEnabled = isInteractive
        screenShieldSwitch.isEnabled = isInteractive
        openAdvancedButton.isEnabled = !isLoadingState
        refreshItem.isEnabled = !isLoadingState && !isSavingState
    }

    private func showFeedback(_ message: String, color: UIColor) {
        feedbackLabel.text = message
        feedbackLabel.textColor = color
        feedbackLabel.isHidden = false
    }

    private func makeCardView() -> UIView {
        let view = UIView()
        view.backgroundColor = .secondarySystemGroupedBackground
        view.layer.cornerRadius = 24
        return view
    }

    private func makeLabel(textStyle: UIFont.TextStyle, weight: UIFont.Weight = .regular) -> UILabel {
        let label = UILabel()
        label.font = UIFont.systemFont(ofSize: UIFont.preferredFont(forTextStyle: textStyle).pointSize, weight: weight)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 1
        return label
    }

    @objc private func handleClose() {
        dismiss(animated: true)
    }

    @objc private func handleRefresh() {
        loadPrivacyState()
    }

    @objc private func handleReadReceiptsChanged() {
        guard let currentState else {
            return
        }

        submitPatch(
            ["shareReadReceipts": shareReadReceiptsSwitch.isOn],
            previousState: currentState
        )
    }

    @objc private func handleNotificationPreviewChanged() {
        guard let currentState else {
            return
        }

        submitPatch(
            ["notificationPreviewMode": NativePrivacyNotificationPreviewMode(segmentIndex: notificationPreviewControl.selectedSegmentIndex).rawValue],
            previousState: currentState
        )
    }

    @objc private func handleScreenShieldChanged() {
        guard let currentState else {
            return
        }

        submitPatch(
            ["screenShieldEnabled": screenShieldSwitch.isOn],
            previousState: currentState
        )
    }

    @objc private func handleOpenAdvancedControls() {
        dismiss(animated: true) { [weak self] in
            self?.shellController?.openWebPrivacyControls()
        }
    }
}

fileprivate final class AdminResetSheetViewController: UIViewController, UITextFieldDelegate {
    private weak var shellController: BuddyListShellViewController?

    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let issueButton = UIButton(type: .system)
    private let refreshButton = UIButton(type: .system)
    private let issueSpinner = UIActivityIndicatorView(style: .medium)
    private let auditSpinner = UIActivityIndicatorView(style: .medium)
    private let feedbackLabel = UILabel()
    private let screennameField = UITextField()
    private let confirmationSwitch = UISwitch()
    private let auditStack = UIStackView()
    private let emptyAuditLabel = UILabel()
    private let resultCard = UIView()
    private let resultSummaryLabel = UILabel()
    private let ticketLabel = UILabel()
    private let expiresLabel = UILabel()
    private let copyTicketButton = UIButton(type: .system)
    private let copyHandoffButton = UIButton(type: .system)

    private var currentTicket: String?
    private var currentHandoff: String?
    private var isIssuing = false
    private var isLoadingAudit = false

    init(shellController: BuddyListShellViewController) {
        self.shellController = shellController
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        title = "Reset Access"
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(handleClose)
        )

        configureScrollView()
        configureContent()
        updateIssueButtonState()
        loadAuditEntries()
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if issueButton.isEnabled {
            handleIssue()
        }
        return true
    }

    private func configureScrollView() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 16

        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])
    }

    private func configureContent() {
        let heroCard = makeCardView()
        let heroIcon = UIImageView(image: UIImage(systemName: "shield.lefthalf.filled"))
        heroIcon.translatesAutoresizingMaskIntoConstraints = false
        heroIcon.tintColor = .systemBlue
        heroIcon.preferredSymbolConfiguration = .init(pointSize: 20, weight: .semibold)
        heroIcon.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.12)
        heroIcon.layer.cornerRadius = 22
        heroIcon.clipsToBounds = true

        let heroTitle = makeLabel(textStyle: .headline, weight: .semibold)
        heroTitle.text = "Recovery Concierge"
        let heroBody = makeLabel(textStyle: .subheadline)
        heroBody.text = "Issue a secure one-time handoff for members who missed recovery setup or need assisted access."
        heroBody.numberOfLines = 0
        heroBody.textColor = .secondaryLabel

        let heroTextStack = UIStackView(arrangedSubviews: [heroTitle, heroBody])
        heroTextStack.axis = .vertical
        heroTextStack.spacing = 6
        heroTextStack.translatesAutoresizingMaskIntoConstraints = false

        heroCard.addSubview(heroIcon)
        heroCard.addSubview(heroTextStack)

        NSLayoutConstraint.activate([
            heroIcon.leadingAnchor.constraint(equalTo: heroCard.leadingAnchor, constant: 18),
            heroIcon.topAnchor.constraint(equalTo: heroCard.topAnchor, constant: 18),
            heroIcon.widthAnchor.constraint(equalToConstant: 44),
            heroIcon.heightAnchor.constraint(equalToConstant: 44),

            heroTextStack.leadingAnchor.constraint(equalTo: heroIcon.trailingAnchor, constant: 14),
            heroTextStack.topAnchor.constraint(equalTo: heroCard.topAnchor, constant: 18),
            heroTextStack.trailingAnchor.constraint(equalTo: heroCard.trailingAnchor, constant: -18),
            heroTextStack.bottomAnchor.constraint(equalTo: heroCard.bottomAnchor, constant: -18)
        ])

        let formCard = makeCardView()
        let formTitle = makeSectionTitleLabel("Member screen name")
        screennameField.borderStyle = .none
        screennameField.placeholder = "KittyKat34"
        screennameField.font = UIFont.preferredFont(forTextStyle: .body)
        screennameField.autocorrectionType = .no
        screennameField.autocapitalizationType = .none
        screennameField.smartDashesType = .no
        screennameField.smartQuotesType = .no
        screennameField.returnKeyType = .go
        screennameField.delegate = self
        screennameField.addTarget(self, action: #selector(handleFieldChange), for: .editingChanged)

        let fieldShell = UIView()
        fieldShell.translatesAutoresizingMaskIntoConstraints = false
        fieldShell.backgroundColor = .tertiarySystemGroupedBackground
        fieldShell.layer.cornerRadius = 18
        fieldShell.layer.borderWidth = 1
        fieldShell.layer.borderColor = UIColor.separator.withAlphaComponent(0.22).cgColor

        screennameField.translatesAutoresizingMaskIntoConstraints = false
        fieldShell.addSubview(screennameField)

        NSLayoutConstraint.activate([
            screennameField.topAnchor.constraint(equalTo: fieldShell.topAnchor, constant: 14),
            screennameField.leadingAnchor.constraint(equalTo: fieldShell.leadingAnchor, constant: 16),
            screennameField.trailingAnchor.constraint(equalTo: fieldShell.trailingAnchor, constant: -16),
            screennameField.bottomAnchor.constraint(equalTo: fieldShell.bottomAnchor, constant: -14)
        ])

        let confirmCard = makeCardView()
        let confirmLabel = makeLabel(textStyle: .subheadline, weight: .medium)
        confirmLabel.text = "I verified this request and will deliver the reset handoff through a trusted channel."
        confirmLabel.numberOfLines = 0
        let confirmRow = UIStackView(arrangedSubviews: [confirmLabel, confirmationSwitch])
        confirmRow.axis = .horizontal
        confirmRow.alignment = .center
        confirmRow.spacing = 14
        confirmRow.translatesAutoresizingMaskIntoConstraints = false
        confirmationSwitch.addTarget(self, action: #selector(handleFieldChange), for: .valueChanged)
        confirmCard.addSubview(confirmRow)

        NSLayoutConstraint.activate([
            confirmRow.topAnchor.constraint(equalTo: confirmCard.topAnchor, constant: 18),
            confirmRow.leadingAnchor.constraint(equalTo: confirmCard.leadingAnchor, constant: 18),
            confirmRow.trailingAnchor.constraint(equalTo: confirmCard.trailingAnchor, constant: -18),
            confirmRow.bottomAnchor.constraint(equalTo: confirmCard.bottomAnchor, constant: -18)
        ])

        issueButton.configuration = .filled()
        issueButton.configuration?.cornerStyle = .large
        issueButton.configuration?.title = "Issue Secure Ticket"
        issueButton.configuration?.image = UIImage(systemName: "paperplane.fill")
        issueButton.configuration?.imagePadding = 8
        issueButton.addTarget(self, action: #selector(handleIssue), for: .touchUpInside)

        issueSpinner.hidesWhenStopped = true
        issueButton.translatesAutoresizingMaskIntoConstraints = false
        issueSpinner.translatesAutoresizingMaskIntoConstraints = false
        issueButton.addSubview(issueSpinner)

        NSLayoutConstraint.activate([
            issueSpinner.centerYAnchor.constraint(equalTo: issueButton.centerYAnchor),
            issueSpinner.trailingAnchor.constraint(equalTo: issueButton.trailingAnchor, constant: -20)
        ])

        feedbackLabel.font = UIFont.preferredFont(forTextStyle: .subheadline)
        feedbackLabel.numberOfLines = 0
        feedbackLabel.isHidden = true

        resultCard.isHidden = true
        let resultTitle = makeSectionTitleLabel("Secure reset ready")
        resultSummaryLabel.font = UIFont.preferredFont(forTextStyle: .subheadline)
        resultSummaryLabel.numberOfLines = 0
        resultSummaryLabel.textColor = .secondaryLabel
        ticketLabel.font = UIFont.monospacedSystemFont(ofSize: 15, weight: .semibold)
        ticketLabel.numberOfLines = 0
        expiresLabel.font = UIFont.preferredFont(forTextStyle: .caption1)
        expiresLabel.numberOfLines = 0
        expiresLabel.textColor = .secondaryLabel

        copyTicketButton.configuration = .tinted()
        copyTicketButton.configuration?.cornerStyle = .medium
        copyTicketButton.configuration?.title = "Copy Ticket"
        copyTicketButton.addTarget(self, action: #selector(handleCopyTicket), for: .touchUpInside)

        copyHandoffButton.configuration = .tinted()
        copyHandoffButton.configuration?.cornerStyle = .medium
        copyHandoffButton.configuration?.title = "Copy Secure Handoff"
        copyHandoffButton.addTarget(self, action: #selector(handleCopyHandoff), for: .touchUpInside)

        let resultButtons = UIStackView(arrangedSubviews: [copyTicketButton, copyHandoffButton])
        resultButtons.axis = .horizontal
        resultButtons.spacing = 10
        resultButtons.distribution = .fillEqually

        let resultStack = UIStackView(arrangedSubviews: [resultTitle, resultSummaryLabel, ticketLabel, expiresLabel, resultButtons])
        resultStack.axis = .vertical
        resultStack.spacing = 12
        resultStack.translatesAutoresizingMaskIntoConstraints = false
        resultCard.addSubview(resultStack)

        NSLayoutConstraint.activate([
            resultStack.topAnchor.constraint(equalTo: resultCard.topAnchor, constant: 18),
            resultStack.leadingAnchor.constraint(equalTo: resultCard.leadingAnchor, constant: 18),
            resultStack.trailingAnchor.constraint(equalTo: resultCard.trailingAnchor, constant: -18),
            resultStack.bottomAnchor.constraint(equalTo: resultCard.bottomAnchor, constant: -18)
        ])

        let activityHeaderLabel = makeSectionTitleLabel("Recent Recovery Activity")
        refreshButton.configuration = .tinted()
        refreshButton.configuration?.cornerStyle = .medium
        refreshButton.configuration?.title = "Refresh"
        refreshButton.addTarget(self, action: #selector(handleRefresh), for: .touchUpInside)

        auditSpinner.hidesWhenStopped = true
        let activityHeader = UIStackView(arrangedSubviews: [activityHeaderLabel, UIView(), auditSpinner, refreshButton])
        activityHeader.axis = .horizontal
        activityHeader.alignment = .center
        activityHeader.spacing = 10

        let activityCard = makeCardView()
        auditStack.axis = .vertical
        auditStack.spacing = 10
        emptyAuditLabel.font = UIFont.preferredFont(forTextStyle: .subheadline)
        emptyAuditLabel.textColor = .secondaryLabel
        emptyAuditLabel.numberOfLines = 0
        emptyAuditLabel.text = "No recent recovery activity yet."
        emptyAuditLabel.isHidden = true

        let activityStack = UIStackView(arrangedSubviews: [activityHeader, emptyAuditLabel, auditStack])
        activityStack.axis = .vertical
        activityStack.spacing = 14
        activityStack.translatesAutoresizingMaskIntoConstraints = false
        activityCard.addSubview(activityStack)

        NSLayoutConstraint.activate([
            activityStack.topAnchor.constraint(equalTo: activityCard.topAnchor, constant: 18),
            activityStack.leadingAnchor.constraint(equalTo: activityCard.leadingAnchor, constant: 18),
            activityStack.trailingAnchor.constraint(equalTo: activityCard.trailingAnchor, constant: -18),
            activityStack.bottomAnchor.constraint(equalTo: activityCard.bottomAnchor, constant: -18)
        ])

        contentStack.addArrangedSubview(heroCard)
        contentStack.addArrangedSubview(formCard)
        contentStack.addArrangedSubview(confirmCard)
        contentStack.addArrangedSubview(issueButton)
        contentStack.addArrangedSubview(feedbackLabel)
        contentStack.addArrangedSubview(resultCard)
        contentStack.addArrangedSubview(activityCard)

        let formStack = UIStackView(arrangedSubviews: [formTitle, fieldShell])
        formStack.axis = .vertical
        formStack.spacing = 10
        formStack.translatesAutoresizingMaskIntoConstraints = false
        formCard.addSubview(formStack)

        NSLayoutConstraint.activate([
            formStack.topAnchor.constraint(equalTo: formCard.topAnchor, constant: 18),
            formStack.leadingAnchor.constraint(equalTo: formCard.leadingAnchor, constant: 18),
            formStack.trailingAnchor.constraint(equalTo: formCard.trailingAnchor, constant: -18),
            formStack.bottomAnchor.constraint(equalTo: formCard.bottomAnchor, constant: -18)
        ])
    }

    private func loadAuditEntries() {
        guard !isLoadingAudit else {
            return
        }

        guard let shellController else {
            showFeedback("Buddy List is still loading.", isError: true)
            return
        }

        isLoadingAudit = true
        refreshButton.isEnabled = false
        auditSpinner.startAnimating()

        shellController.loadAdminResetAudit(limit: 12) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else {
                    return
                }

                self.isLoadingAudit = false
                self.refreshButton.isEnabled = true
                self.auditSpinner.stopAnimating()

                switch result {
                case .success(let entries):
                    self.renderAuditEntries(entries)
                case .failure(let error):
                    self.renderAuditError(error.localizedDescription)
                }
            }
        }
    }

    private func renderAuditEntries(_ entries: [NativeAdminResetAuditItem]) {
        auditStack.arrangedSubviews.forEach { view in
            auditStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        emptyAuditLabel.textColor = .secondaryLabel

        if entries.isEmpty {
            emptyAuditLabel.text = "No recent recovery activity yet."
            emptyAuditLabel.isHidden = false
            return
        }

        emptyAuditLabel.isHidden = true

        for entry in entries {
            auditStack.addArrangedSubview(makeAuditEntryView(entry))
        }
    }

    private func renderAuditError(_ message: String) {
        auditStack.arrangedSubviews.forEach { view in
            auditStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        emptyAuditLabel.text = message
        emptyAuditLabel.textColor = .systemRed
        emptyAuditLabel.isHidden = false
    }

    private func makeAuditEntryView(_ entry: NativeAdminResetAuditItem) -> UIView {
        let card = UIView()
        card.backgroundColor = .tertiarySystemGroupedBackground
        card.layer.cornerRadius = 18

        let titleLabel = makeLabel(textStyle: .subheadline, weight: .semibold)
        titleLabel.text = entry.title

        let timestampLabel = makeLabel(textStyle: .caption1)
        timestampLabel.text = entry.timestamp
        timestampLabel.textColor = .secondaryLabel

        let actorLabel = makeLabel(textStyle: .caption1)
        actorLabel.text = "Actor: \(entry.actorLabel)"

        let targetLabel = makeLabel(textStyle: .caption1)
        targetLabel.text = "Target: \(entry.targetLabel)"

        var arrangedSubviews: [UIView] = [titleLabel, timestampLabel, actorLabel, targetLabel]
        if let reason = entry.reason, !reason.isEmpty {
            let reasonLabel = makeLabel(textStyle: .caption1)
            reasonLabel.text = "Reason: \(reason)"
            arrangedSubviews.append(reasonLabel)
        }

        let stack = UIStackView(arrangedSubviews: arrangedSubviews)
        stack.axis = .vertical
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -14)
        ])

        return card
    }

    private func updateIssueButtonState() {
        let hasScreenname = !(screennameField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        issueButton.isEnabled = !isIssuing && confirmationSwitch.isOn && hasScreenname
    }

    private func showFeedback(_ message: String, isError: Bool) {
        feedbackLabel.text = message
        feedbackLabel.textColor = isError ? .systemRed : .systemGreen
        feedbackLabel.isHidden = false
    }

    private func updateResult(screenname: String, ticket: String, expiresAt: String, handoff: String, feedback: String?) {
        currentTicket = ticket
        currentHandoff = handoff
        resultCard.isHidden = false
        resultSummaryLabel.text = feedback ?? "Secure handoff ready for \(screenname)."
        ticketLabel.text = ticket
        expiresLabel.text = "Expires: \(formatTimestamp(expiresAt))"
    }

    private func formatTimestamp(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: value) {
            return DateFormatter.localizedString(from: date, dateStyle: .medium, timeStyle: .short)
        }

        return value
    }

    private func makeCardView() -> UIView {
        let view = UIView()
        view.backgroundColor = .secondarySystemGroupedBackground
        view.layer.cornerRadius = 24
        return view
    }

    private func makeSectionTitleLabel(_ text: String) -> UILabel {
        let label = makeLabel(textStyle: .footnote, weight: .semibold)
        label.text = text.uppercased()
        label.textColor = .secondaryLabel
        return label
    }

    private func makeLabel(textStyle: UIFont.TextStyle, weight: UIFont.Weight = .regular) -> UILabel {
        let label = UILabel()
        label.font = UIFont.systemFont(ofSize: UIFont.preferredFont(forTextStyle: textStyle).pointSize, weight: weight)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 1
        return label
    }

    @objc private func handleClose() {
        dismiss(animated: true)
    }

    @objc private func handleFieldChange() {
        updateIssueButtonState()
    }

    @objc private func handleRefresh() {
        emptyAuditLabel.textColor = .secondaryLabel
        loadAuditEntries()
    }

    @objc private func handleIssue() {
        guard !isIssuing else {
            return
        }

        let screenname = (screennameField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !screenname.isEmpty else {
            showFeedback("Enter a screen name.", isError: true)
            return
        }

        guard confirmationSwitch.isOn else {
            showFeedback("Confirm that this is an authorized reset request first.", isError: true)
            return
        }

        guard let shellController else {
            showFeedback("Buddy List is still loading.", isError: true)
            return
        }

        isIssuing = true
        issueSpinner.startAnimating()
        issueButton.configuration?.title = "Issuing..."
        updateIssueButtonState()
        feedbackLabel.isHidden = true

        shellController.issueAdminResetTicket(screenname: screenname) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else {
                    return
                }

                self.isIssuing = false
                self.issueSpinner.stopAnimating()
                self.issueButton.configuration?.title = "Issue Secure Ticket"
                self.updateIssueButtonState()

                switch result {
                case .success(let response):
                    guard
                        let resolvedScreenname = response.screenname,
                        let ticket = response.ticket,
                        let expiresAt = response.expiresAt,
                        let handoff = response.handoff
                    else {
                        self.showFeedback("Buddy List returned an incomplete reset response.", isError: true)
                        return
                    }

                    self.updateResult(
                        screenname: resolvedScreenname,
                        ticket: ticket,
                        expiresAt: expiresAt,
                        handoff: handoff,
                        feedback: response.feedback
                    )
                    self.showFeedback(response.feedback ?? "Secure handoff ready.", isError: false)
                    self.loadAuditEntries()
                case .failure(let error):
                    self.showFeedback(error.localizedDescription, isError: true)
                }
            }
        }
    }

    @objc private func handleCopyTicket() {
        guard let currentTicket else {
            return
        }

        UIPasteboard.general.string = currentTicket
        showFeedback("Reset ticket copied.", isError: false)
    }

    @objc private func handleCopyHandoff() {
        guard let currentHandoff else {
            return
        }

        UIPasteboard.general.string = currentHandoff
        showFeedback("Secure handoff copied.", isError: false)
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
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
