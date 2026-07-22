import SwiftUI

enum NativeMilestoneOnePhase: String, Decodable {
    case loading
    case signedOut
    case signedIn
    case hidden
}

enum NativeMilestoneOnePresence: String, Decodable {
    case available
    case idle
    case away
    case offline
}

struct NativeMilestoneOneBuddy: Decodable, Equatable, Identifiable {
    let id: String
    let screenname: String
    let presence: NativeMilestoneOnePresence
    let presenceLabel: String
    let presenceDetail: String
    let awayMessage: String?
    let unreadCount: Int
    let isPinned: Bool
    let circleId: String?
    let presenceHidden: Bool?
}

struct NativeMilestoneOneCircle: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
    let showPresence: Bool
    let muted: Bool
    let memberCount: Int
}

struct NativeMilestoneOnePendingRequest: Decodable, Equatable, Identifiable {
    let id: String
    let screenname: String
}

struct NativeMilestoneOneMessage: Decodable, Equatable, Identifiable {
    let id: String
    let senderId: String
    let content: String
    let createdAt: String
    let isMine: Bool
    let isDeleted: Bool
    let deliveredAt: String?
    let readAt: String?
    let deliveryStatus: String?
    let deliveryStatusDetail: String?
    let showDeliveryStatus: Bool
    let previewType: String?
}

struct NativeMilestoneOneSharedRoom: Decodable, Equatable, Identifiable {
    let id: String
    let slug: String
    let name: String
}

struct NativeMilestoneOneMutualBuddy: Decodable, Equatable, Identifiable {
    let id: String
    let screenname: String
}

struct NativeMilestoneOneConversation: Decodable, Equatable {
    let buddyId: String
    let screenname: String
    let presence: NativeMilestoneOnePresence
    let presenceLabel: String
    let presenceDetail: String
    let statusLine: String?
    let awayMessage: String?
    let isPinned: Bool
    let isMuted: Bool
    let isArchived: Bool
    let sharedRooms: [NativeMilestoneOneSharedRoom]
    let mutualBuddies: [NativeMilestoneOneMutualBuddy]
    let mutualBuddyCount: Int
    let isLoadingMutualContext: Bool
    let mutualContextError: String?
    let messages: [NativeMilestoneOneMessage]
    let isLoading: Bool
    let isSending: Bool
    let typingText: String?
    let error: String?
}

enum NativeMilestoneOneSection: String, Decodable {
    case buddies
    case rooms
}

struct NativeMilestoneOneRoom: Decodable, Equatable, Identifiable {
    let id: String
    let slug: String
    let name: String
    let subtitle: String
    let unreadCount: Int
    let isJoined: Bool
    let activeCount: Int
    let activeScreennames: [String]
}

struct NativeMilestoneOneRoomParticipant: Decodable, Equatable, Identifiable {
    let id: String
    let screenname: String
    let isMe: Bool
}

struct NativeMilestoneOneRoomMessage: Decodable, Equatable, Identifiable {
    let id: String
    let senderId: String
    let senderScreenname: String
    let content: String
    let createdAt: String
    let isMine: Bool
}

struct NativeMilestoneOneRoomConversation: Decodable, Equatable {
    let roomId: String
    let roomName: String
    let activeCount: Int
    let participants: [NativeMilestoneOneRoomParticipant]
    let messages: [NativeMilestoneOneRoomMessage]
    let isLoading: Bool
    let isSending: Bool
    let typingText: String?
    let error: String?
}

struct NativeMilestoneOneState: Decodable, Equatable {
    let phase: NativeMilestoneOnePhase
    let selectedSection: NativeMilestoneOneSection
    let screenname: String?
    let currentPresence: NativeMilestoneOnePresence?
    let currentPresenceDetail: String?
    let currentAwayMessage: String?
    let buddies: [NativeMilestoneOneBuddy]
    let circles: [NativeMilestoneOneCircle]
    let pendingRequests: [NativeMilestoneOnePendingRequest]
    let onlineCount: Int
    let pendingRequestCount: Int
    let isRefreshing: Bool
    let isDark: Bool
    let error: String?
    let activeConversation: NativeMilestoneOneConversation?
    let rooms: [NativeMilestoneOneRoom]
    let activeRoomConversation: NativeMilestoneOneRoomConversation?

    static let loading = NativeMilestoneOneState(
        phase: .loading,
        selectedSection: .buddies,
        screenname: nil,
        currentPresence: nil,
        currentPresenceDetail: nil,
        currentAwayMessage: nil,
        buddies: [],
        circles: [],
        pendingRequests: [],
        onlineCount: 0,
        pendingRequestCount: 0,
        isRefreshing: false,
        isDark: true,
        error: nil,
        activeConversation: nil,
        rooms: [],
        activeRoomConversation: nil
    )

    init(
        phase: NativeMilestoneOnePhase,
        selectedSection: NativeMilestoneOneSection,
        screenname: String?,
        currentPresence: NativeMilestoneOnePresence?,
        currentPresenceDetail: String?,
        currentAwayMessage: String?,
        buddies: [NativeMilestoneOneBuddy],
        circles: [NativeMilestoneOneCircle],
        pendingRequests: [NativeMilestoneOnePendingRequest],
        onlineCount: Int,
        pendingRequestCount: Int,
        isRefreshing: Bool,
        isDark: Bool,
        error: String?,
        activeConversation: NativeMilestoneOneConversation?,
        rooms: [NativeMilestoneOneRoom],
        activeRoomConversation: NativeMilestoneOneRoomConversation?
    ) {
        self.phase = phase
        self.selectedSection = selectedSection
        self.screenname = screenname
        self.currentPresence = currentPresence
        self.currentPresenceDetail = currentPresenceDetail
        self.currentAwayMessage = currentAwayMessage
        self.buddies = buddies
        self.circles = circles
        self.pendingRequests = pendingRequests
        self.onlineCount = max(0, onlineCount)
        self.pendingRequestCount = max(pendingRequests.count, max(0, pendingRequestCount))
        self.isRefreshing = isRefreshing
        self.isDark = isDark
        self.error = error
        self.activeConversation = activeConversation
        self.rooms = rooms
        self.activeRoomConversation = activeRoomConversation
    }

    private enum CodingKeys: String, CodingKey {
        case phase
        case selectedSection
        case screenname
        case currentPresence
        case currentPresenceDetail
        case currentAwayMessage
        case buddies
        case circles
        case pendingRequests
        case onlineCount
        case pendingRequestCount
        case isRefreshing
        case isDark
        case error
        case activeConversation
        case rooms
        case activeRoomConversation
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        phase = try container.decodeIfPresent(NativeMilestoneOnePhase.self, forKey: .phase) ?? .hidden
        selectedSection = try container.decodeIfPresent(NativeMilestoneOneSection.self, forKey: .selectedSection) ?? .buddies
        screenname = try container.decodeIfPresent(String.self, forKey: .screenname)
        currentPresence = try container.decodeIfPresent(NativeMilestoneOnePresence.self, forKey: .currentPresence)
        currentPresenceDetail = try container.decodeIfPresent(String.self, forKey: .currentPresenceDetail)
        currentAwayMessage = try container.decodeIfPresent(String.self, forKey: .currentAwayMessage)
        buddies = try container.decodeIfPresent([NativeMilestoneOneBuddy].self, forKey: .buddies) ?? []
        circles = try container.decodeIfPresent([NativeMilestoneOneCircle].self, forKey: .circles) ?? []
        pendingRequests = try container.decodeIfPresent([NativeMilestoneOnePendingRequest].self, forKey: .pendingRequests) ?? []
        onlineCount = max(0, try container.decodeIfPresent(Int.self, forKey: .onlineCount) ?? 0)
        pendingRequestCount = max(
            pendingRequests.count,
            max(0, try container.decodeIfPresent(Int.self, forKey: .pendingRequestCount) ?? 0)
        )
        isRefreshing = try container.decodeIfPresent(Bool.self, forKey: .isRefreshing) ?? false
        isDark = try container.decodeIfPresent(Bool.self, forKey: .isDark) ?? true
        error = try container.decodeIfPresent(String.self, forKey: .error)
        activeConversation = try container.decodeIfPresent(NativeMilestoneOneConversation.self, forKey: .activeConversation)
        rooms = try container.decodeIfPresent([NativeMilestoneOneRoom].self, forKey: .rooms) ?? []
        activeRoomConversation = try container.decodeIfPresent(NativeMilestoneOneRoomConversation.self, forKey: .activeRoomConversation)
    }
}

struct NativeMilestoneOneActionResponse: Decodable {
    let ok: Bool
    let error: String?
}

private struct NativeAwayReplyIntent {
    let buddyID: String
    let awayMessage: String
}

final class NativeMilestoneOneViewModel: ObservableObject, @unchecked Sendable {
    typealias ActionCompletion = (Result<NativeMilestoneOneActionResponse, Error>) -> Void

    @Published private(set) var state: NativeMilestoneOneState = .loading
    @Published var screenname = ""
    @Published var password = ""
    @Published private(set) var isPerformingAction = false
    @Published private(set) var isRefreshing = false
    @Published private(set) var isUpdatingPresence = false
    @Published private(set) var isSendingMessage = false
    @Published private(set) var isSendingRoomMessage = false
    @Published private(set) var processingKnockBuddyID: String?
    @Published private(set) var recentlyKnockedBuddyID: String?
    @Published private(set) var processingCircleBuddyID: String?
    @Published private(set) var processingRequestID: String?
    @Published private(set) var processingConversationAction: String?
    @Published private(set) var actionError: String?
    private var pendingAwayReply: NativeAwayReplyIntent?

    var onSignIn: ((String, String, @escaping ActionCompletion) -> Void)?
    var onRefresh: ((@escaping ActionCompletion) -> Void)?
    var onRefreshRooms: ((@escaping ActionCompletion) -> Void)?
    var onOpenBuddy: ((String, @escaping ActionCompletion) -> Void)?
    var onOpenRoom: ((String, @escaping ActionCompletion) -> Void)?
    var onUpdatePresence: ((String, String, @escaping ActionCompletion) -> Void)?
    var onRespondToBuddyRequest: ((String, String, @escaping ActionCompletion) -> Void)?
    var onSendMessage: ((String, String, @escaping ActionCompletion) -> Void)?
    var onSendKnock: ((String, @escaping ActionCompletion) -> Void)?
    var onSetBuddyCircle: ((String, String?, @escaping ActionCompletion) -> Void)?
    var onCloseConversation: ((@escaping ActionCompletion) -> Void)?
    var onSendTypingPulse: ((String, @escaping ActionCompletion) -> Void)?
    var onSendRoomMessage: ((String, String, @escaping ActionCompletion) -> Void)?
    var onCloseRoomConversation: ((@escaping ActionCompletion) -> Void)?
    var onSendRoomTypingPulse: ((String, @escaping ActionCompletion) -> Void)?
    var onOpenProfile: ((String, @escaping ActionCompletion) -> Void)?
    var onTogglePinned: ((String, @escaping ActionCompletion) -> Void)?
    var onToggleMuted: ((String, @escaping ActionCompletion) -> Void)?
    var onToggleArchived: ((String, @escaping ActionCompletion) -> Void)?
    var onSignOut: ((@escaping ActionCompletion) -> Void)?
    var onShowWebAuth: ((String, @escaping ActionCompletion) -> Void)?

    func apply(_ nextState: NativeMilestoneOneState) {
        state = nextState
        if let error = nextState.error, !error.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            actionError = error
        } else if nextState.phase == .signedIn {
            actionError = nil
        }
        if nextState.phase != .signedOut {
            password = ""
        }
        if nextState.phase == .signedIn || nextState.phase == .hidden {
            isPerformingAction = false
        }
        if nextState.activeConversation?.isSending == false {
            isSendingMessage = false
        }
        if nextState.activeRoomConversation?.isSending == false {
            isSendingRoomMessage = false
        }
    }

    func signIn() {
        let trimmedScreenname = screenname.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedScreenname.isEmpty, !password.isEmpty else {
            actionError = "Enter your screen name and password."
            return
        }
        guard let onSignIn else {
            actionError = "H.I.M. is still connecting."
            return
        }

        actionError = nil
        isPerformingAction = true
        onSignIn(trimmedScreenname, password) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isPerformingAction = false
                self.consume(result)
            }
        }
    }

    func refresh() async {
        guard let onRefresh, !isRefreshing else { return }
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.isRefreshing = true
            }
            onRefresh { [weak self] result in
                DispatchQueue.main.async {
                    self?.isRefreshing = false
                    self?.consume(result)
                    continuation.resume()
                }
            }
        }
    }

    func refreshRooms() async {
        guard let onRefreshRooms, !isRefreshing else { return }
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.isRefreshing = true
            }
            onRefreshRooms { [weak self] result in
                DispatchQueue.main.async {
                    self?.isRefreshing = false
                    self?.consume(result)
                    continuation.resume()
                }
            }
        }
    }

    func openBuddy(_ buddyID: String) {
        guard let onOpenBuddy else { return }
        onOpenBuddy(buddyID) { [weak self] result in
            DispatchQueue.main.async {
                self?.consume(result)
            }
        }
    }

    func replyToAwayMessage(_ buddy: NativeMilestoneOneBuddy) {
        guard let awayMessage = buddy.awayMessage?.trimmingCharacters(in: .whitespacesAndNewlines),
              !awayMessage.isEmpty else {
            openBuddy(buddy.id)
            return
        }

        pendingAwayReply = NativeAwayReplyIntent(buddyID: buddy.id, awayMessage: awayMessage)
        openBuddy(buddy.id)
    }

    func takePendingAwayReply(for buddyID: String) -> String? {
        guard pendingAwayReply?.buddyID == buddyID else { return nil }
        let awayMessage = pendingAwayReply?.awayMessage
        pendingAwayReply = nil
        return awayMessage
    }

    func openRoom(_ roomID: String) {
        guard let onOpenRoom else { return }
        onOpenRoom(roomID) { [weak self] result in
            DispatchQueue.main.async {
                self?.consume(result)
            }
        }
    }

    func beginPresenceEditing() {
        actionError = nil
    }

    func updatePresence(status: String, awayMessage: String) async -> Bool {
        guard let onUpdatePresence else {
            actionError = "Presence controls are still connecting."
            return false
        }
        guard !isUpdatingPresence else { return false }

        actionError = nil
        isUpdatingPresence = true
        return await withCheckedContinuation { continuation in
            onUpdatePresence(status, awayMessage) { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else {
                        continuation.resume(returning: false)
                        return
                    }

                    self.isUpdatingPresence = false
                    self.consume(result)
                    if case .success(let response) = result {
                        continuation.resume(returning: response.ok)
                    } else {
                        continuation.resume(returning: false)
                    }
                }
            }
        }
    }

    func respondToBuddyRequest(_ requestID: String, action: String) {
        guard let onRespondToBuddyRequest else {
            actionError = "Buddy requests are still connecting."
            return
        }
        guard processingRequestID == nil else { return }

        actionError = nil
        processingRequestID = requestID
        onRespondToBuddyRequest(requestID, action) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.processingRequestID = nil
                self.consume(result)
            }
        }
    }

    func sendMessage(buddyID: String, content: String) async -> Bool {
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedContent.isEmpty else {
            actionError = "Type a message first."
            return false
        }
        guard let onSendMessage else {
            actionError = "Messages are still connecting."
            return false
        }
        guard !isSendingMessage else { return false }

        actionError = nil
        isSendingMessage = true
        return await withCheckedContinuation { continuation in
            onSendMessage(buddyID, trimmedContent) { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else {
                        continuation.resume(returning: false)
                        return
                    }

                    self.isSendingMessage = false
                    self.consume(result)
                    if case .success(let response) = result {
                        continuation.resume(returning: response.ok)
                    } else {
                        continuation.resume(returning: false)
                    }
                }
            }
        }
    }

    func sendKnock(buddyID: String) {
        guard let onSendKnock else {
            actionError = "Knock is still connecting."
            return
        }
        guard processingKnockBuddyID == nil else { return }

        actionError = nil
        processingKnockBuddyID = buddyID
        onSendKnock(buddyID) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.processingKnockBuddyID = nil
                self.consume(result)
                if case .success(let response) = result, response.ok {
                    self.recentlyKnockedBuddyID = buddyID
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                        if self?.recentlyKnockedBuddyID == buddyID {
                            self?.recentlyKnockedBuddyID = nil
                        }
                    }
                }
            }
        }
    }

    func setBuddyCircle(buddyID: String, circleID: String?) {
        guard let onSetBuddyCircle else {
            actionError = "Circles are still connecting."
            return
        }
        guard processingCircleBuddyID == nil else { return }

        actionError = nil
        processingCircleBuddyID = buddyID
        onSetBuddyCircle(buddyID, circleID) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.processingCircleBuddyID = nil
                self.consume(result)
            }
        }
    }

    func closeConversation() {
        guard let onCloseConversation else { return }
        onCloseConversation { [weak self] result in
            DispatchQueue.main.async {
                self?.consume(result)
            }
        }
    }

    func sendTypingPulse(buddyID: String) {
        guard let onSendTypingPulse else { return }
        onSendTypingPulse(buddyID) { _ in }
    }

    func sendRoomMessage(roomID: String, content: String) async -> Bool {
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedContent.isEmpty else {
            actionError = "Type a message first."
            return false
        }
        guard let onSendRoomMessage else {
            actionError = "Room messages are still connecting."
            return false
        }
        guard !isSendingRoomMessage else { return false }

        actionError = nil
        isSendingRoomMessage = true
        return await withCheckedContinuation { continuation in
            onSendRoomMessage(roomID, trimmedContent) { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else {
                        continuation.resume(returning: false)
                        return
                    }

                    self.isSendingRoomMessage = false
                    self.consume(result)
                    if case .success(let response) = result {
                        continuation.resume(returning: response.ok)
                    } else {
                        continuation.resume(returning: false)
                    }
                }
            }
        }
    }

    func closeRoomConversation() {
        guard let onCloseRoomConversation else { return }
        onCloseRoomConversation { [weak self] result in
            DispatchQueue.main.async {
                self?.consume(result)
            }
        }
    }

    func sendRoomTypingPulse(roomID: String) {
        guard let onSendRoomTypingPulse else { return }
        onSendRoomTypingPulse(roomID) { _ in }
    }

    func openProfile(buddyID: String) async -> Bool {
        guard let onOpenProfile else {
            actionError = "Profile controls are still connecting."
            return false
        }

        return await performConversationAction("profile") { completion in
            onOpenProfile(buddyID, completion)
        }
    }

    func togglePinned(buddyID: String) async -> Bool {
        guard let onTogglePinned else {
            actionError = "Pin controls are still connecting."
            return false
        }

        return await performConversationAction("pin") { completion in
            onTogglePinned(buddyID, completion)
        }
    }

    func toggleMuted(buddyID: String) async -> Bool {
        guard let onToggleMuted else {
            actionError = "Mute controls are still connecting."
            return false
        }

        return await performConversationAction("mute") { completion in
            onToggleMuted(buddyID, completion)
        }
    }

    func toggleArchived(buddyID: String) async -> Bool {
        guard let onToggleArchived else {
            actionError = "Archive controls are still connecting."
            return false
        }

        return await performConversationAction("archive") { completion in
            onToggleArchived(buddyID, completion)
        }
    }

    func signOut() {
        guard let onSignOut, !isPerformingAction else { return }
        isPerformingAction = true
        onSignOut { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isPerformingAction = false
                self.consume(result)
            }
        }
    }

    func showWebAuth(_ mode: String) {
        guard let onShowWebAuth, !isPerformingAction else { return }
        actionError = nil
        onShowWebAuth(mode) { [weak self] result in
            DispatchQueue.main.async {
                self?.consume(result)
            }
        }
    }

    private func performConversationAction(
        _ actionID: String,
        handler: (@escaping ActionCompletion) -> Void
    ) async -> Bool {
        guard processingConversationAction == nil else { return false }

        actionError = nil
        processingConversationAction = actionID
        return await withCheckedContinuation { continuation in
            handler { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else {
                        continuation.resume(returning: false)
                        return
                    }

                    self.processingConversationAction = nil
                    self.consume(result)
                    if case .success(let response) = result {
                        continuation.resume(returning: response.ok)
                    } else {
                        continuation.resume(returning: false)
                    }
                }
            }
        }
    }

    private func consume(_ result: Result<NativeMilestoneOneActionResponse, Error>) {
        switch result {
        case .success(let response):
            actionError = response.ok ? nil : (response.error ?? "H.I.M. could not complete that action.")
        case .failure(let error):
            actionError = error.localizedDescription
        }
    }
}

struct NativeMilestoneOneRootView: View {
    @ObservedObject var model: NativeMilestoneOneViewModel

    var body: some View {
        Group {
            switch model.state.phase {
            case .loading:
                NativeMilestoneLoadingView(isDark: model.state.isDark)
            case .signedOut:
                NativeMilestoneSignInView(model: model)
            case .signedIn:
                if let conversation = model.state.activeConversation {
                    NativeConversationView(model: model, conversation: conversation)
                } else if let roomConversation = model.state.activeRoomConversation {
                    NativeRoomConversationView(model: model, conversation: roomConversation)
                } else if model.state.selectedSection == .rooms {
                    NativeRoomsView(model: model)
                } else {
                    NativeBuddyListView(model: model)
                }
            case .hidden:
                Color.clear
            }
        }
        .preferredColorScheme(model.state.isDark ? .dark : .light)
    }
}

private struct NativeMilestoneLoadingView: View {
    let isDark: Bool

    var body: some View {
        ZStack {
            NativeMilestonePalette.background(isDark: isDark).ignoresSafeArea()
            VStack(spacing: 18) {
                Text("H.I.M.")
                    .font(.system(size: 42, weight: .black, design: .rounded))
                    .foregroundColor(NativeMilestonePalette.gold)
                ProgressView()
                    .tint(NativeMilestonePalette.gold)
                Text("Connecting your BuddyList…")
                    .font(.subheadline)
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
            }
        }
    }
}

private struct NativeMilestoneSignInView: View {
    private enum Field: Hashable {
        case screenname
        case password
    }

    @ObservedObject var model: NativeMilestoneOneViewModel
    @FocusState private var focusedField: Field?

    var body: some View {
        ZStack {
            NativeMilestonePalette.authBackground.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    Spacer(minLength: 48)

                    VStack(spacing: 8) {
                        Text("H.I.M.")
                            .font(.system(size: 48, weight: .black, design: .rounded))
                            .foregroundColor(NativeMilestonePalette.gold)
                        Text("Hi, it's me.")
                            .font(.headline)
                            .foregroundColor(.white.opacity(0.92))
                        Text("Your people. Your presence. Right here.")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.62))
                    }
                    .multilineTextAlignment(.center)

                    VStack(spacing: 16) {
                        NativeMilestoneFieldLabel(title: "Screen Name", systemImage: "person.fill")
                        TextField("Screen Name", text: $model.screenname)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textContentType(.username)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .screenname)
                            .onSubmit { focusedField = .password }
                            .nativeMilestoneFieldStyle()

                        NativeMilestoneFieldLabel(title: "Password", systemImage: "lock.fill")
                        SecureField("Password", text: $model.password)
                            .textContentType(.password)
                            .submitLabel(.go)
                            .focused($focusedField, equals: .password)
                            .onSubmit { model.signIn() }
                            .nativeMilestoneFieldStyle()

                        if let error = model.actionError {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundColor(Color(red: 1, green: 0.63, blue: 0.57))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(action: model.signIn) {
                            HStack(spacing: 10) {
                                if model.isPerformingAction {
                                    ProgressView().tint(.white)
                                }
                                Text(model.isPerformingAction ? "Dialing in…" : "Sign On")
                                    .fontWeight(.bold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(NativeMilestonePalette.gold)
                        .disabled(model.isPerformingAction)

                        HStack(spacing: 18) {
                            Button("Forgot password?") { model.showWebAuth("forgotPassword") }
                            Button("Create account") { model.showWebAuth("signup") }
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundColor(NativeMilestonePalette.gold)
                    }
                    .padding(22)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(.white.opacity(0.1), lineWidth: 1)
                    }

                    Text("Private messaging, close by design.")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.48))
                    Spacer(minLength: 28)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear { focusedField = .screenname }
    }
}

private struct NativeMilestoneFieldLabel: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.bold))
            .foregroundColor(.white.opacity(0.72))
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, -10)
    }
}

private struct NativeBuddyListView: View {
    @ObservedObject var model: NativeMilestoneOneViewModel
    @State private var presenceEditor: NativePresenceEditorDestination?

    var body: some View {
        configuredList
            .refreshable { await model.refresh() }
            .background(NativeMilestonePalette.background(isDark: model.state.isDark).ignoresSafeArea())
            .sheet(item: $presenceEditor) { destination in
                NativePresenceEditorSheet(destination: destination, model: model)
            }
    }

    private func buddyRow(_ buddy: NativeMilestoneOneBuddy) -> some View {
        NativeBuddyRow(
            buddy: buddy,
            isDark: model.state.isDark,
            isKnocking: model.processingKnockBuddyID == buddy.id,
            didKnock: model.recentlyKnockedBuddyID == buddy.id,
            circles: model.state.circles,
            currentCircleID: buddy.circleId,
            open: { model.openBuddy(buddy.id) },
            reply: { model.replyToAwayMessage(buddy) },
            knock: { model.sendKnock(buddyID: buddy.id) },
            setCircle: { circleID in model.setBuddyCircle(buddyID: buddy.id, circleID: circleID) }
        )
        .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
        .listRowSeparatorTint(NativeMilestonePalette.separator(isDark: model.state.isDark))
    }

    // Circles take over the buddy list when the owner has any; otherwise a single
    // flat "Buddies" section, matching the prior behavior.
    @ViewBuilder
    private var buddySections: some View {
        if model.state.buddies.isEmpty {
            Section {
                NativeEmptyBuddyList(isDark: model.state.isDark)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }
        } else if model.state.circles.isEmpty {
            Section {
                ForEach(model.state.buddies) { buddy in
                    buddyRow(buddy)
                }
            } header: {
                HStack {
                    Text("Buddies")
                    Spacer()
                    Text("\(model.state.onlineCount) online")
                        .foregroundColor(NativeMilestonePalette.green)
                }
                .font(.caption.weight(.bold))
            }
        } else {
            ForEach(model.state.circles) { circle in
                let members = model.state.buddies.filter { $0.circleId == circle.id }
                Section {
                    if members.isEmpty {
                        Text("No buddies here yet — long-press a buddy to add them.")
                            .font(.footnote)
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
                    } else {
                        ForEach(members) { buddy in
                            buddyRow(buddy)
                        }
                    }
                } header: {
                    NativeCircleSectionHeader(circle: circle, memberCount: members.count, isDark: model.state.isDark)
                }
            }
            let ungrouped = model.state.buddies.filter { $0.circleId == nil }
            if !ungrouped.isEmpty {
                Section {
                    ForEach(ungrouped) { buddy in
                        buddyRow(buddy)
                    }
                } header: {
                    HStack {
                        Text("Ungrouped")
                        Spacer()
                        Text("\(ungrouped.count)")
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                    }
                    .font(.caption.weight(.bold))
                }
            }
        }
    }

    @ViewBuilder
    private var configuredList: some View {
        if #available(iOS 16.0, *) {
            listContent.scrollContentBackground(.hidden)
        } else {
            listContent
        }
    }

    private var listContent: some View {
        List {
            Section {
                NativeCurrentUserCard(state: model.state)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                NativePresenceControls(state: model.state) {
                    model.beginPresenceEditing()
                    presenceEditor = NativePresenceEditorDestination(
                        initialPresence: model.state.currentPresence == .away ? .away : .available,
                        initialAwayMessage: model.state.currentAwayMessage ?? ""
                    )
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if let error = model.actionError {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundColor(.red)
                        .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
                }
            }

            if !model.state.pendingRequests.isEmpty {
                Section {
                    ForEach(model.state.pendingRequests) { request in
                        NativePendingRequestRow(
                            request: request,
                            isDark: model.state.isDark,
                            isProcessing: model.processingRequestID == request.id,
                            actionsDisabled: model.processingRequestID != nil,
                            accept: {
                                model.respondToBuddyRequest(request.id, action: "accept")
                            },
                            decline: {
                                model.respondToBuddyRequest(request.id, action: "decline")
                            }
                        )
                        .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
                        .listRowSeparatorTint(NativeMilestonePalette.separator(isDark: model.state.isDark))
                    }
                } header: {
                    HStack {
                        Text("Buddy Requests")
                        Spacer()
                        Text("\(model.state.pendingRequests.count)")
                            .foregroundColor(NativeMilestonePalette.gold)
                    }
                    .font(.caption.weight(.bold))
                }
            } else if model.state.pendingRequestCount > 0 {
                Section {
                    Label(
                        "\(model.state.pendingRequestCount) pending buddy request\(model.state.pendingRequestCount == 1 ? "" : "s")",
                        systemImage: "person.crop.circle.badge.plus"
                    )
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.gold)
                    .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
                }
            }

            buddySections

            Section {
                Button(role: .destructive, action: model.signOut) {
                    Label("Sign Off", systemImage: "rectangle.portrait.and.arrow.right")
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .disabled(model.isPerformingAction)
                .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
            }
        }
        .listStyle(.plain)
        .environment(\.defaultMinListRowHeight, 56)
    }
}

private struct NativeRoomsView: View {
    @ObservedObject var model: NativeMilestoneOneViewModel

    var body: some View {
        configuredList
            .refreshable { await model.refreshRooms() }
            .background(NativeMilestonePalette.background(isDark: model.state.isDark).ignoresSafeArea())
    }

    @ViewBuilder
    private var configuredList: some View {
        if #available(iOS 16.0, *) {
            listContent.scrollContentBackground(.hidden)
        } else {
            listContent
        }
    }

    private var listContent: some View {
        List {
            if let error = model.actionError {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundColor(.red)
                        .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
                }
            }

            Section {
                if model.state.rooms.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 32, weight: .semibold))
                            .foregroundColor(NativeMilestonePalette.gold)
                        Text("No global rooms available")
                            .font(.headline)
                            .foregroundColor(NativeMilestonePalette.text(isDark: model.state.isDark))
                        Text("Pull to refresh the room directory.")
                            .font(.subheadline)
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 36)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else {
                    ForEach(model.state.rooms) { room in
                        Button {
                            model.openRoom(room.id)
                        } label: {
                            NativeRoomRow(room: room, isDark: model.state.isDark)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(NativeMilestonePalette.card(isDark: model.state.isDark))
                        .listRowSeparatorTint(NativeMilestonePalette.separator(isDark: model.state.isDark))
                    }
                }
            } header: {
                HStack {
                    Text("Global Rooms")
                    Spacer()
                    Text("\(model.state.rooms.count)")
                        .foregroundColor(NativeMilestonePalette.gold)
                }
                .font(.caption.weight(.bold))
            }
        }
        .listStyle(.plain)
        .environment(\.defaultMinListRowHeight, 62)
    }
}

private struct NativeRoomRow: View {
    let room: NativeMilestoneOneRoom
    let isDark: Bool

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: "number")
                .font(.headline.weight(.black))
                .foregroundColor(Color.black.opacity(0.82))
                .frame(width: 44, height: 44)
                .background(NativeMilestonePalette.gold, in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    Text(room.name)
                        .font(.body.weight(.bold))
                        .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                        .lineLimit(1)
                    Text(room.isJoined ? "JOINED" : "JOIN")
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .foregroundColor(room.isJoined ? NativeMilestonePalette.green : NativeMilestonePalette.gold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(
                            (room.isJoined ? NativeMilestonePalette.green : NativeMilestonePalette.gold).opacity(0.12),
                            in: Capsule()
                        )
                }
                Text(room.subtitle)
                    .font(.caption)
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                    .lineLimit(1)
                HStack(spacing: 5) {
                    Circle()
                        .fill(room.activeCount > 0 ? NativeMilestonePalette.green : NativeMilestonePalette.muted(isDark: isDark))
                        .frame(width: 6, height: 6)
                    Text(room.activeCount == 1 ? "1 active" : "\(room.activeCount) active")
                        .foregroundColor(room.activeCount > 0
                            ? NativeMilestonePalette.green
                            : NativeMilestonePalette.muted(isDark: isDark))
                    if !room.activeScreennames.isEmpty {
                        Text("· \(room.activeScreennames.prefix(3).joined(separator: ", "))")
                            .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                            .lineLimit(1)
                    }
                }
                .font(.caption2.weight(.semibold))
            }

            Spacer(minLength: 8)

            if room.unreadCount > 0 {
                Text("\(room.unreadCount)")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(NativeMilestonePalette.gold, in: Capsule())
                    .accessibilityLabel("\(room.unreadCount) unread messages")
            }

            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NativeMilestonePalette.muted(isDark: isDark).opacity(0.7))
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(room.name), \(room.isJoined ? "joined" : "not joined"), \(room.activeCount) active")
        .accessibilityHint(room.isJoined ? "Opens the room" : "Joins and opens the room")
    }
}

private struct NativeRoomConversationView: View {
    @ObservedObject var model: NativeMilestoneOneViewModel
    let conversation: NativeMilestoneOneRoomConversation
    @State private var draft = ""
    @FocusState private var composerFocused: Bool

    var body: some View {
        ZStack {
            NativeMilestonePalette.background(isDark: model.state.isDark).ignoresSafeArea()

            VStack(spacing: 0) {
                NativeRoomConversationHeader(
                    conversation: conversation,
                    isDark: model.state.isDark,
                    close: model.closeRoomConversation
                )

                NativeRoomActiveRoster(
                    participants: conversation.participants,
                    isDark: model.state.isDark
                )

                Divider()
                    .overlay(NativeMilestonePalette.separator(isDark: model.state.isDark))

                messageScrollback

                NativeConversationComposer(
                    draft: $draft,
                    isSending: model.isSendingRoomMessage || conversation.isSending,
                    isDark: model.state.isDark,
                    send: sendDraft,
                    typing: {
                        model.sendRoomTypingPulse(roomID: conversation.roomId)
                    }
                )
                .focused($composerFocused)
            }
        }
        .onAppear { composerFocused = true }
    }

    private var messageScrollback: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if conversation.isLoading && conversation.messages.isEmpty {
                        ProgressView("Loading room...")
                            .tint(NativeMilestonePalette.gold)
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            .padding(.top, 28)
                    } else if conversation.messages.isEmpty {
                        NativeEmptyRoomConversationView(roomName: conversation.roomName, isDark: model.state.isDark)
                            .padding(.top, 42)
                    }

                    ForEach(conversation.messages) { message in
                        NativeRoomMessageBubble(message: message, isDark: model.state.isDark)
                    }

                    if let typingText = conversation.typingText, !typingText.isEmpty {
                        Text(typingText)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(NativeMilestonePalette.gold)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 18)
                    }

                    if let error = conversation.error, !error.isEmpty {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 18)
                    }

                    Color.clear
                        .frame(height: 1)
                        .id("native-room-conversation-bottom")
                }
                .padding(.vertical, 14)
            }
            .onAppear { scrollToBottom(proxy) }
            .onChange(of: conversation.messages.count) { _ in
                scrollToBottom(proxy)
            }
        }
    }

    private func sendDraft() {
        let trimmedDraft = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedDraft.isEmpty else { return }

        Task {
            let didSend = await model.sendRoomMessage(roomID: conversation.roomId, content: trimmedDraft)
            if didSend {
                draft = ""
            }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo("native-room-conversation-bottom", anchor: .bottom)
            }
        }
    }
}

private struct NativeRoomConversationHeader: View {
    let conversation: NativeMilestoneOneRoomConversation
    let isDark: Bool
    let close: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: close) {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.bold))
                    .frame(width: 34, height: 34)
                    .background(NativeMilestonePalette.card(isDark: isDark), in: Circle())
            }
            .buttonStyle(.plain)
            .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
            .accessibilityLabel("Back to rooms")

            Image(systemName: "number")
                .font(.headline.weight(.black))
                .foregroundColor(Color.black.opacity(0.82))
                .frame(width: 42, height: 42)
                .background(NativeMilestonePalette.gold, in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(conversation.roomName)
                    .font(.headline.weight(.bold))
                    .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                    .lineLimit(1)
                Text(conversation.activeCount == 1 ? "1 active now" : "\(conversation.activeCount) active now")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(conversation.activeCount > 0
                        ? NativeMilestonePalette.green
                        : NativeMilestonePalette.muted(isDark: isDark))
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }
}

private struct NativeRoomActiveRoster: View {
    let participants: [NativeMilestoneOneRoomParticipant]
    let isDark: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("ACTIVE NOW")
                .font(.caption2.weight(.black))
                .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))

            if participants.isEmpty {
                Text("No one else is active yet.")
                    .font(.caption)
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(participants) { participant in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(NativeMilestonePalette.green)
                                    .frame(width: 7, height: 7)
                                Text(participant.isMe ? "\(participant.screenname) (You)" : participant.screenname)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(
                                NativeMilestonePalette.card(isDark: isDark),
                                in: Capsule()
                            )
                            .overlay {
                                Capsule()
                                    .stroke(NativeMilestonePalette.separator(isDark: isDark), lineWidth: 1)
                            }
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
        .accessibilityElement(children: .contain)
    }
}

private struct NativeRoomMessageBubble: View {
    let message: NativeMilestoneOneRoomMessage
    let isDark: Bool

    var body: some View {
        HStack {
            if message.isMine {
                Spacer(minLength: 44)
            }

            VStack(alignment: message.isMine ? .trailing : .leading, spacing: 4) {
                if !message.isMine {
                    Text(message.senderScreenname)
                        .font(.caption2.weight(.bold))
                        .foregroundColor(NativeMilestonePalette.gold)
                        .padding(.horizontal, 4)
                }

                Text(message.content.isEmpty ? " " : message.content)
                    .font(.body)
                    .foregroundColor(message.isMine ? Color.black.opacity(0.88) : NativeMilestonePalette.text(isDark: isDark))
                    .padding(.horizontal, 13)
                    .padding(.vertical, 10)
                    .background(
                        message.isMine ? NativeMilestonePalette.gold : NativeMilestonePalette.card(isDark: isDark),
                        in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                    )

                Text(NativeMilestoneFormatters.messageTime(message.createdAt))
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark).opacity(0.82))
                    .padding(.horizontal, 4)
            }
            .frame(maxWidth: 300, alignment: message.isMine ? .trailing : .leading)

            if !message.isMine {
                Spacer(minLength: 44)
            }
        }
        .padding(.horizontal, 16)
    }
}

private struct NativeEmptyRoomConversationView: View {
    let roomName: String
    let isDark: Bool

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "number")
                .font(.system(size: 34, weight: .bold))
                .foregroundColor(NativeMilestonePalette.gold)
            Text("No room messages yet")
                .font(.headline)
                .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
            Text("Start the conversation in \(roomName).")
                .font(.subheadline)
                .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
    }
}

private struct NativeConversationView: View {
    @ObservedObject var model: NativeMilestoneOneViewModel
    let conversation: NativeMilestoneOneConversation
    @State private var draft = ""
    @State private var awayReplyQuote: String?
    @State private var controlsDestination: NativeConversationControlsDestination?
    @FocusState private var composerFocused: Bool

    var body: some View {
        ZStack {
            NativeMilestonePalette.background(isDark: model.state.isDark).ignoresSafeArea()

            VStack(spacing: 0) {
                NativeConversationHeader(
                    conversation: conversation,
                    isDark: model.state.isDark,
                    isKnocking: model.processingKnockBuddyID == conversation.buddyId,
                    didKnock: model.recentlyKnockedBuddyID == conversation.buddyId,
                    close: model.closeConversation,
                    knock: { model.sendKnock(buddyID: conversation.buddyId) },
                    openControls: {
                        controlsDestination = NativeConversationControlsDestination(buddyID: conversation.buddyId)
                    }
                )

                if let awayMessage = conversation.awayMessage?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !awayMessage.isEmpty {
                    NativeAwayMessageCard(
                        awayMessage: awayMessage,
                        isDark: model.state.isDark,
                        isReplying: awayReplyQuote != nil,
                        reply: {
                            awayReplyQuote = awayMessage
                            composerFocused = true
                        }
                    )
                }

                Divider()
                    .overlay(NativeMilestonePalette.separator(isDark: model.state.isDark))

                messageScrollback

                if let awayReplyQuote {
                    NativeAwayReplyComposerContext(
                        awayMessage: awayReplyQuote,
                        isDark: model.state.isDark,
                        cancel: { self.awayReplyQuote = nil }
                    )
                }

                NativeConversationComposer(
                    draft: $draft,
                    isSending: model.isSendingMessage || conversation.isSending,
                    isDark: model.state.isDark,
                    send: sendDraft,
                    typing: {
                        model.sendTypingPulse(buddyID: conversation.buddyId)
                    }
                )
                .focused($composerFocused)
            }
        }
        .onAppear {
            if awayReplyQuote == nil {
                awayReplyQuote = model.takePendingAwayReply(for: conversation.buddyId)
            }
            composerFocused = true
        }
        .sheet(item: $controlsDestination) { destination in
            NativeConversationControlsSheet(destination: destination, model: model)
        }
    }

    private var messageScrollback: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if conversation.isLoading && conversation.messages.isEmpty {
                        ProgressView("Loading messages...")
                            .tint(NativeMilestonePalette.gold)
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            .padding(.top, 28)
                    } else if conversation.messages.isEmpty {
                        NativeEmptyConversationView(screenname: conversation.screenname, isDark: model.state.isDark)
                            .padding(.top, 42)
                    }

                    ForEach(conversation.messages) { message in
                        NativeMessageBubble(message: message, isDark: model.state.isDark)
                    }

                    if let typingText = conversation.typingText, !typingText.isEmpty {
                        Text(typingText)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(NativeMilestonePalette.gold)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 18)
                    }

                    if let error = conversation.error, !error.isEmpty {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 18)
                    }

                    Color.clear
                        .frame(height: 1)
                        .id("native-conversation-bottom")
                }
                .padding(.vertical, 14)
            }
            .onAppear {
                scrollToBottom(proxy)
            }
            .onChange(of: conversation.messages.count) { _ in
                scrollToBottom(proxy)
            }
        }
    }

    private func sendDraft() {
        let trimmedDraft = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedDraft.isEmpty else { return }

        let content = awayReplyQuote.map { formatAwayMessageReply(awayMessage: $0, reply: trimmedDraft) }
            ?? trimmedDraft

        Task {
            let didSend = await model.sendMessage(buddyID: conversation.buddyId, content: content)
            if didSend {
                draft = ""
                awayReplyQuote = nil
            }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo("native-conversation-bottom", anchor: .bottom)
            }
        }
    }
}

private func formatAwayMessageReply(awayMessage: String, reply: String) -> String {
    let normalizedAwayMessage = awayMessage
        .split(whereSeparator: { $0.isWhitespace })
        .joined(separator: " ")
    return "Replying to away message:\n“\(normalizedAwayMessage)”\n\n\(reply)"
}

private struct NativeAwayMessageCard: View {
    let awayMessage: String
    let isDark: Bool
    let isReplying: Bool
    let reply: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "quote.bubble.fill")
                .foregroundColor(NativeMilestonePalette.gold)

            VStack(alignment: .leading, spacing: 3) {
                Text("AWAY MESSAGE")
                    .font(.caption2.weight(.black))
                    .foregroundColor(NativeMilestonePalette.gold)
                Text(awayMessage)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Button(isReplying ? "Replying" : "Reply", action: reply)
                .font(.caption.weight(.bold))
                .buttonStyle(.bordered)
                .tint(NativeMilestonePalette.gold)
                .disabled(isReplying)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(NativeMilestonePalette.gold.opacity(isDark ? 0.08 : 0.1))
        .accessibilityElement(children: .contain)
    }
}

private struct NativeAwayReplyComposerContext: View {
    let awayMessage: String
    let isDark: Bool
    let cancel: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Rectangle()
                .fill(NativeMilestonePalette.gold)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 2) {
                Text("Replying to away message")
                    .font(.caption2.weight(.black))
                    .foregroundColor(NativeMilestonePalette.gold)
                Text(awayMessage)
                    .font(.caption)
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Button(action: cancel) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel away message reply")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .background(NativeMilestonePalette.card(isDark: isDark))
    }
}

private struct NativeConversationControlsDestination: Identifiable {
    let buddyID: String

    var id: String { buddyID }
}

private struct NativeConversationHeader: View {
    let conversation: NativeMilestoneOneConversation
    let isDark: Bool
    let isKnocking: Bool
    let didKnock: Bool
    let close: () -> Void
    let knock: () -> Void
    let openControls: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: close) {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.bold))
                    .frame(width: 34, height: 34)
                    .background(NativeMilestonePalette.card(isDark: isDark), in: Circle())
            }
            .buttonStyle(.plain)
            .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
            .accessibilityLabel("Back to BuddyList")

            NativeBuddyAvatar(name: conversation.screenname, presence: conversation.presence, size: 42)

            VStack(alignment: .leading, spacing: 2) {
                Text(conversation.screenname)
                    .font(.headline.weight(.bold))
                    .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                    .lineLimit(1)
                Text(conversation.statusLine?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                    ? conversation.statusLine ?? conversation.presenceDetail
                    : conversation.presenceDetail)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                    .lineLimit(1)
            }

            Spacer()

            Button(action: knock) {
                if isKnocking {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: didKnock ? "checkmark" : "hand.wave.fill")
                        .font(.subheadline.weight(.bold))
                }
            }
            .frame(width: 36, height: 36)
            .background(NativeMilestonePalette.gold.opacity(0.14), in: Circle())
            .buttonStyle(.plain)
            .foregroundColor(NativeMilestonePalette.gold)
            .disabled(isKnocking || didKnock)
            .accessibilityLabel(didKnock ? "Knock sent" : "Knock \(conversation.screenname)")

            Button(action: openControls) {
                Image(systemName: "ellipsis.circle.fill")
                    .font(.title3.weight(.bold))
                    .frame(width: 36, height: 36)
                    .background(NativeMilestonePalette.card(isDark: isDark), in: Circle())
            }
            .buttonStyle(.plain)
            .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
            .accessibilityLabel("Conversation controls")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }
}

private struct NativeConversationControlsSheet: View {
    let destination: NativeConversationControlsDestination
    @ObservedObject var model: NativeMilestoneOneViewModel
    @Environment(\.dismiss) private var dismiss

    private var conversation: NativeMilestoneOneConversation? {
        guard let activeConversation = model.state.activeConversation,
              activeConversation.buddyId == destination.buddyID else {
            return nil
        }

        return activeConversation
    }

    var body: some View {
        NavigationView {
            List {
                if let conversation {
                    Section {
                        HStack(spacing: 12) {
                            NativeBuddyAvatar(
                                name: conversation.screenname,
                                presence: conversation.presence,
                                size: 46
                            )

                            VStack(alignment: .leading, spacing: 3) {
                                Text(conversation.screenname)
                                    .font(.headline.weight(.bold))
                                    .foregroundColor(NativeMilestonePalette.text(isDark: model.state.isDark))
                                Text(conversation.presenceDetail)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Section("You both know") {
                        if conversation.isLoadingMutualContext {
                            HStack(spacing: 10) {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Finding shared context...")
                                    .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            }
                        } else if conversation.mutualContextError != nil {
                            Label("Shared context is unavailable right now.", systemImage: "exclamationmark.triangle")
                                .font(.footnote)
                                .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                        } else if conversation.sharedRooms.isEmpty && conversation.mutualBuddyCount == 0 {
                            Text("No shared rooms or mutual buddies yet.")
                                .font(.footnote)
                                .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                        } else {
                            ForEach(conversation.sharedRooms) { room in
                                Label(room.name, systemImage: "person.3.fill")
                            }

                            ForEach(conversation.mutualBuddies) { buddy in
                                Label(buddy.screenname, systemImage: "person.crop.circle.badge.checkmark")
                            }

                            let remainingBuddyCount = max(
                                0,
                                conversation.mutualBuddyCount - conversation.mutualBuddies.count
                            )
                            if remainingBuddyCount > 0 {
                                Text("+\(remainingBuddyCount) more mutual buddies")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                            }
                        }

                        Text("Shared relationships only—not a compatibility score.")
                            .font(.caption2)
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                    }

                    Section {
                        NativeConversationControlButton(
                            title: "View Profile",
                            systemImage: "person.crop.circle.fill",
                            isProcessing: model.processingConversationAction == "profile",
                            isDisabled: model.processingConversationAction != nil,
                            role: nil
                        ) {
                            runAction(dismissOnSuccess: true) {
                                await model.openProfile(buddyID: conversation.buddyId)
                            }
                        }

                        NativeConversationControlButton(
                            title: conversation.isPinned ? "Unpin Conversation" : "Pin Conversation",
                            systemImage: conversation.isPinned ? "pin.slash.fill" : "pin.fill",
                            isProcessing: model.processingConversationAction == "pin",
                            isDisabled: model.processingConversationAction != nil,
                            role: nil
                        ) {
                            runAction {
                                await model.togglePinned(buddyID: conversation.buddyId)
                            }
                        }

                        NativeConversationControlButton(
                            title: conversation.isMuted ? "Unmute Conversation" : "Mute Conversation",
                            systemImage: conversation.isMuted ? "bell.fill" : "bell.slash.fill",
                            isProcessing: model.processingConversationAction == "mute",
                            isDisabled: model.processingConversationAction != nil,
                            role: nil
                        ) {
                            runAction {
                                await model.toggleMuted(buddyID: conversation.buddyId)
                            }
                        }

                        NativeConversationControlButton(
                            title: conversation.isArchived ? "Unarchive Conversation" : "Archive Conversation",
                            systemImage: conversation.isArchived ? "archivebox.fill" : "archivebox.fill",
                            isProcessing: model.processingConversationAction == "archive",
                            isDisabled: model.processingConversationAction != nil,
                            role: conversation.isArchived ? nil : .destructive
                        ) {
                            runAction(dismissOnSuccess: !conversation.isArchived) {
                                await model.toggleArchived(buddyID: conversation.buddyId)
                            }
                        }
                    } footer: {
                        if let error = model.actionError {
                            Text(error)
                                .foregroundColor(.red)
                        }
                    }
                } else {
                    Section {
                        Text("That conversation is no longer open.")
                            .foregroundColor(NativeMilestonePalette.muted(isDark: model.state.isDark))
                    }
                }
            }
            .navigationTitle("Conversation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func runAction(
        dismissOnSuccess: Bool = false,
        action: @escaping () async -> Bool
    ) {
        Task {
            let didSucceed = await action()
            if didSucceed && dismissOnSuccess {
                dismiss()
            }
        }
    }
}

private struct NativeConversationControlButton: View {
    let title: String
    let systemImage: String
    let isProcessing: Bool
    let isDisabled: Bool
    let role: ButtonRole?
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            HStack(spacing: 12) {
                Label(title, systemImage: systemImage)
                Spacer()
                if isProcessing {
                    ProgressView()
                }
            }
        }
        .disabled(isDisabled)
    }
}

private struct NativeMessageBubble: View {
    let message: NativeMilestoneOneMessage
    let isDark: Bool

    var body: some View {
        HStack {
            if message.isMine {
                Spacer(minLength: 44)
            }

            VStack(alignment: message.isMine ? .trailing : .leading, spacing: 4) {
                messageContent

                Text(NativeMilestoneFormatters.messageTime(message.createdAt))
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark).opacity(0.82))
                    .padding(.horizontal, 4)

                if message.showDeliveryStatus {
                    HStack(spacing: 4) {
                        Image(systemName: message.deliveryStatus == "read" ? "checkmark.seal.fill" : "checkmark")
                            .font(.caption2.weight(.bold))
                            .foregroundColor(message.deliveryStatus == "read" ? .blue : NativeMilestonePalette.muted(isDark: isDark))
                        Text(deliveryLabel)
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(NativeMilestonePalette.muted(isDark: isDark).opacity(0.9))
                    }
                    .padding(.horizontal, 4)
                }
            }
            .frame(maxWidth: 300, alignment: message.isMine ? .trailing : .leading)

            if !message.isMine {
                Spacer(minLength: 44)
            }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var messageContent: some View {
        if message.previewType == "knock", !message.isDeleted {
            HStack(spacing: 7) {
                Text("👋")
                Text(message.isMine ? "You knocked" : "Knock — wants to talk")
                    .font(.body.weight(.semibold))
            }
            .foregroundColor(NativeMilestonePalette.gold)
            .padding(.horizontal, 13)
            .padding(.vertical, 10)
            .background(
                NativeMilestonePalette.gold.opacity(isDark ? 0.12 : 0.1),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(NativeMilestonePalette.gold.opacity(0.3), lineWidth: 1)
            }
        } else if message.previewType == "buzz", !message.isDeleted {
            HStack(spacing: 7) {
                Image(systemName: "bolt.fill")
                Text(message.isMine ? "You buzzed" : "Buzz!")
                    .font(.body.weight(.bold))
            }
            .foregroundColor(NativeMilestonePalette.gold)
            .padding(.horizontal, 13)
            .padding(.vertical, 10)
            .background(bubbleBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        } else {
            Text(message.content.isEmpty ? " " : message.content)
                .font(.body)
                .foregroundColor(message.isMine ? Color.black.opacity(0.88) : NativeMilestonePalette.text(isDark: isDark))
                .padding(.horizontal, 13)
                .padding(.vertical, 10)
                .background(bubbleBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private var bubbleBackground: Color {
        if message.isDeleted {
            return NativeMilestonePalette.muted(isDark: isDark).opacity(0.16)
        }
        return message.isMine ? NativeMilestonePalette.gold : NativeMilestonePalette.card(isDark: isDark)
    }

    private var deliveryLabel: String {
        switch message.deliveryStatus {
        case "read":
            if let detail = message.deliveryStatusDetail, !detail.isEmpty {
                return "Read · \(detail)"
            }
            return "Read"
        case "delivered":
            return "Delivered"
        default:
            return "Sent"
        }
    }
}

private struct NativeConversationComposer: View {
    @Binding var draft: String
    let isSending: Bool
    let isDark: Bool
    let send: () -> Void
    let typing: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            TextField("Message", text: $draft)
                .textInputAutocapitalization(.sentences)
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .background(NativeMilestonePalette.card(isDark: isDark), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(NativeMilestonePalette.separator(isDark: isDark), lineWidth: 1)
                }
                .onChange(of: draft) { _ in
                    typing()
                }
                .submitLabel(.send)
                .onSubmit(send)

            Button(action: send) {
                if isSending {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "paperplane.fill")
                        .font(.headline.weight(.bold))
                }
            }
            .frame(width: 44, height: 44)
            .background(canSend ? NativeMilestonePalette.gold : NativeMilestonePalette.muted(isDark: isDark).opacity(0.24), in: Circle())
            .foregroundColor(canSend ? Color.black.opacity(0.88) : NativeMilestonePalette.muted(isDark: isDark))
            .disabled(!canSend || isSending)
            .accessibilityLabel("Send message")
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(.ultraThinMaterial)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

private struct NativeEmptyConversationView: View {
    let screenname: String
    let isDark: Bool

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 34, weight: .semibold))
                .foregroundColor(NativeMilestonePalette.gold)
            Text("No messages yet")
                .font(.headline)
                .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
            Text("Say hi to \(screenname).")
                .font(.subheadline)
                .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
    }
}

private enum NativeEditablePresence: String, CaseIterable, Identifiable {
    case available
    case away

    var id: String { rawValue }

    var title: String {
        switch self {
        case .available:
            return "Available"
        case .away:
            return "Away"
        }
    }
}

private struct NativePresenceEditorDestination: Identifiable {
    let id = UUID()
    let initialPresence: NativeEditablePresence
    let initialAwayMessage: String
}

private struct NativePresenceControls: View {
    let state: NativeMilestoneOneState
    let edit: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: edit) {
                NativePresenceControlLabel(
                    eyebrow: "Status",
                    value: statusLabel,
                    systemImage: "circle.fill",
                    accent: NativeMilestonePalette.presence(state.currentPresence ?? .available),
                    isDark: state.isDark
                )
            }
            .buttonStyle(.plain)

            Button(action: edit) {
                NativePresenceControlLabel(
                    eyebrow: "Away message",
                    value: awayMessageLabel,
                    systemImage: "quote.bubble.fill",
                    accent: NativeMilestonePalette.gold,
                    isDark: state.isDark
                )
            }
            .buttonStyle(.plain)
        }
        .accessibilityElement(children: .contain)
    }

    private var statusLabel: String {
        switch state.currentPresence ?? .available {
        case .available:
            return "Available"
        case .idle:
            return "Idle"
        case .away:
            return "Away"
        case .offline:
            return "Offline"
        }
    }

    private var awayMessageLabel: String {
        let message = (state.currentAwayMessage ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return message.isEmpty ? "Set message" : "Edit message"
    }
}

private struct NativePresenceControlLabel: View {
    let eyebrow: String
    let value: String
    let systemImage: String
    let accent: Color
    let isDark: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.bold))
                .foregroundColor(accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(eyebrow)
                    .font(.caption2.weight(.bold))
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                    .textCase(.uppercase)
                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.right")
                .font(.caption2.weight(.bold))
                .foregroundColor(NativeMilestonePalette.muted(isDark: isDark).opacity(0.75))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, minHeight: 58)
        .background(NativeMilestonePalette.card(isDark: isDark), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(NativeMilestonePalette.separator(isDark: isDark), lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

private struct NativePresenceEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: NativeMilestoneOneViewModel
    @State private var selectedPresence: NativeEditablePresence
    @State private var awayMessage: String

    init(destination: NativePresenceEditorDestination, model: NativeMilestoneOneViewModel) {
        self.model = model
        _selectedPresence = State(initialValue: destination.initialPresence)
        _awayMessage = State(initialValue: destination.initialAwayMessage)
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Presence") {
                    Picker("Presence status", selection: $selectedPresence) {
                        ForEach(NativeEditablePresence.allCases) { option in
                            Text(option.title).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if selectedPresence == .away {
                    Section {
                        ZStack(alignment: .topLeading) {
                            if awayMessage.isEmpty {
                                Text("What should buddies see while you're away?")
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 8)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $awayMessage)
                                .frame(minHeight: 112)
                                .background(Color.clear)
                        }
                        Text("\(awayMessage.count)/320")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    } header: {
                        Text("Away message")
                    } footer: {
                        Text("Use %n for names, %t for time, and %d for date.")
                    }
                }

                if let error = model.actionError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Presence")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: awayMessage) { nextValue in
                if nextValue.count > 320 {
                    awayMessage = String(nextValue.prefix(320))
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(model.isUpdatingPresence)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        save()
                    } label: {
                        if model.isUpdatingPresence {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(isSaveDisabled)
                }
            }
        }
        .tint(NativeMilestonePalette.gold)
        .preferredColorScheme(model.state.isDark ? .dark : .light)
    }

    private var isSaveDisabled: Bool {
        model.isUpdatingPresence || (
            selectedPresence == .away &&
            awayMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        )
    }

    private func save() {
        let trimmedMessage = awayMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            let didSave = await model.updatePresence(
                status: selectedPresence.rawValue,
                awayMessage: selectedPresence == .away ? trimmedMessage : ""
            )
            if didSave {
                dismiss()
            }
        }
    }
}

private struct NativeCurrentUserCard: View {
    let state: NativeMilestoneOneState

    var body: some View {
        HStack(spacing: 14) {
            NativeBuddyAvatar(name: state.screenname ?? "Me", presence: state.currentPresence ?? .available, size: 52)
            VStack(alignment: .leading, spacing: 4) {
                Text(state.screenname ?? "H.I.M. member")
                    .font(.headline)
                    .foregroundColor(NativeMilestonePalette.text(isDark: state.isDark))
                Text(state.currentPresenceDetail ?? "Available")
                    .font(.subheadline)
                    .foregroundColor(NativeMilestonePalette.muted(isDark: state.isDark))
                    .lineLimit(2)
            }
            Spacer()
            Text("ME")
                .font(.caption2.weight(.black))
                .foregroundColor(NativeMilestonePalette.gold)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(NativeMilestonePalette.gold.opacity(0.14), in: Capsule())
        }
        .padding(16)
        .background(NativeMilestonePalette.card(isDark: state.isDark), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(NativeMilestonePalette.gold.opacity(0.18), lineWidth: 1)
        }
    }
}

private struct NativePendingRequestRow: View {
    let request: NativeMilestoneOnePendingRequest
    let isDark: Bool
    let isProcessing: Bool
    let actionsDisabled: Bool
    let accept: () -> Void
    let decline: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.system(size: 30, weight: .semibold))
                .foregroundColor(NativeMilestonePalette.gold)
                .frame(width: 42, height: 42)
                .background(NativeMilestonePalette.gold.opacity(0.12), in: Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(request.screenname)
                    .font(.body.weight(.semibold))
                    .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                    .lineLimit(1)
                Text("Wants to join your BuddyList")
                    .font(.caption)
                    .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            HStack(spacing: 6) {
                Button("Decline", action: decline)
                    .buttonStyle(.bordered)

                Button(action: accept) {
                    if isProcessing {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text("Accept")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(NativeMilestonePalette.gold)
            }
            .font(.caption.weight(.semibold))
            .disabled(actionsDisabled)
        }
        .padding(.vertical, 5)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Buddy request from \(request.screenname)")
    }
}

private struct NativeCircleSectionHeader: View {
    let circle: NativeMilestoneOneCircle
    let memberCount: Int
    let isDark: Bool

    var body: some View {
        HStack(spacing: 6) {
            Text(circle.name)
            if !circle.showPresence {
                Image(systemName: "eye.slash")
                    .accessibilityLabel("Presence hidden")
            }
            if circle.muted {
                Image(systemName: "bell.slash")
                    .accessibilityLabel("Muted")
            }
            Spacer()
            Text("\(memberCount)")
                .foregroundColor(NativeMilestonePalette.gold)
        }
        .font(.caption.weight(.bold))
    }
}

private struct NativeBuddyRow: View {
    let buddy: NativeMilestoneOneBuddy
    let isDark: Bool
    let isKnocking: Bool
    let didKnock: Bool
    let circles: [NativeMilestoneOneCircle]
    let currentCircleID: String?
    let open: () -> Void
    let reply: () -> Void
    let knock: () -> Void
    let setCircle: (String?) -> Void

    var body: some View {
        HStack(spacing: 13) {
            Button(action: open) {
                HStack(spacing: 13) {
                    NativeBuddyAvatar(name: buddy.screenname, presence: buddy.presence, size: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(buddy.screenname)
                                .font(.body.weight(.semibold))
                                .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
                            if buddy.isPinned {
                                Image(systemName: "pin.fill")
                                    .font(.caption2)
                                    .foregroundColor(NativeMilestonePalette.gold)
                            }
                        }
                        Text(buddy.presenceHidden == true ? "Presence hidden" : buddy.presenceDetail)
                            .font(.caption)
                            .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                            .lineLimit(1)
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer(minLength: 8)
            if buddy.unreadCount > 0 {
                Text("\(buddy.unreadCount)")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(NativeMilestonePalette.gold, in: Capsule())
                    .accessibilityLabel("\(buddy.unreadCount) unread messages")
            }
            if buddy.presence == .away, buddy.awayMessage?.isEmpty == false {
                Button("Reply", action: reply)
                    .font(.caption.weight(.bold))
                    .buttonStyle(.bordered)
                    .tint(NativeMilestonePalette.gold)
                    .accessibilityLabel("Reply to \(buddy.screenname)'s away message")
            }
            Button(action: knock) {
                if isKnocking {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: didKnock ? "checkmark" : "hand.wave.fill")
                        if buddy.presence != .away {
                            Text(didKnock ? "Sent" : "Knock")
                        }
                    }
                }
            }
            .font(.caption.weight(.bold))
            .buttonStyle(.bordered)
            .tint(NativeMilestonePalette.gold)
            .disabled(isKnocking || didKnock)
            .accessibilityLabel(didKnock ? "Knock sent to \(buddy.screenname)" : "Knock \(buddy.screenname)")
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .contain)
        .contextMenu {
            Section("Move to circle") {
                ForEach(circles) { circle in
                    Button {
                        setCircle(circle.id)
                    } label: {
                        Label(
                            circle.name,
                            systemImage: currentCircleID == circle.id ? "checkmark.circle.fill" : "circle"
                        )
                    }
                    .disabled(currentCircleID == circle.id)
                }
                Button {
                    setCircle(nil)
                } label: {
                    Label(
                        "Ungrouped",
                        systemImage: currentCircleID == nil ? "checkmark.circle.fill" : "circle"
                    )
                }
                .disabled(currentCircleID == nil)
            }
        }
    }
}

private struct NativeBuddyAvatar: View {
    let name: String
    let presence: NativeMilestoneOnePresence
    let size: CGFloat

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [NativeMilestonePalette.gold.opacity(0.92), NativeMilestonePalette.lavender.opacity(0.82)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay {
                    Text(initials)
                        .font(.system(size: size * 0.33, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                }

            Circle()
                .fill(NativeMilestonePalette.presence(presence))
                .frame(width: size * 0.28, height: size * 0.28)
                .overlay { Circle().stroke(Color.white, lineWidth: 2) }
                .accessibilityHidden(true)
        }
    }

    private var initials: String {
        let pieces = name.split(whereSeparator: { $0.isWhitespace })
        let value = pieces.prefix(2).compactMap(\.first).map(String.init).joined()
        return String((value.isEmpty ? name : value).prefix(2)).uppercased()
    }
}

private struct NativeEmptyBuddyList: View {
    let isDark: Bool

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(NativeMilestonePalette.gold)
            Text("Your BuddyList is ready")
                .font(.headline)
                .foregroundColor(NativeMilestonePalette.text(isDark: isDark))
            Text("Use Find to add your first buddy. Their live presence will appear here.")
                .font(.subheadline)
                .foregroundColor(NativeMilestonePalette.muted(isDark: isDark))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 34)
    }
}

private enum NativeMilestonePalette {
    static let gold = Color(red: 232 / 255, green: 162 / 255, blue: 58 / 255)
    static let green = Color(red: 78 / 255, green: 201 / 255, blue: 122 / 255)
    static let lavender = Color(red: 167 / 255, green: 139 / 255, blue: 250 / 255)
    static let authBackground = LinearGradient(
        colors: [Color(red: 9 / 255, green: 13 / 255, blue: 28 / 255), Color(red: 26 / 255, green: 31 / 255, blue: 58 / 255)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func background(isDark: Bool) -> Color {
        isDark
            ? Color(red: 15 / 255, green: 20 / 255, blue: 36 / 255)
            : Color(red: 245 / 255, green: 241 / 255, blue: 232 / 255)
    }

    static func card(isDark: Bool) -> Color {
        isDark
            ? Color(red: 26 / 255, green: 31 / 255, blue: 58 / 255)
            : Color(red: 255 / 255, green: 252 / 255, blue: 246 / 255)
    }

    static func text(isDark: Bool) -> Color {
        isDark
            ? Color(red: 247 / 255, green: 240 / 255, blue: 232 / 255)
            : Color(red: 26 / 255, green: 26 / 255, blue: 26 / 255)
    }

    static func muted(isDark: Bool) -> Color {
        isDark
            ? Color(red: 156 / 255, green: 142 / 255, blue: 130 / 255)
            : Color(red: 107 / 255, green: 107 / 255, blue: 107 / 255)
    }

    static func separator(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }

    static func presence(_ state: NativeMilestoneOnePresence) -> Color {
        switch state {
        case .available:
            return green
        case .idle:
            return lavender
        case .away:
            return gold
        case .offline:
            return Color(red: 122 / 255, green: 115 / 255, blue: 108 / 255)
        }
    }
}

private enum NativeMilestoneFormatters {
    private static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoStandard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let shortTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()

    static func messageTime(_ rawValue: String) -> String {
        let date = isoWithFractionalSeconds.date(from: rawValue) ?? isoStandard.date(from: rawValue)
        guard let date else { return "" }
        return shortTime.string(from: date)
    }
}

private extension View {
    func nativeMilestoneFieldStyle() -> some View {
        self
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(0.11), lineWidth: 1)
            }
    }
}
