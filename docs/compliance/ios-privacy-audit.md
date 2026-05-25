# iOS Privacy Manifest Audit

Audited: 2026-05-25  
Xcode requirement: 15+ (required for App Store submission)  
Apple reference: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files

## Summary

| File | Status | Required-reason APIs |
|------|--------|----------------------|
| `ios/App/App/PrivacyInfo.xcprivacy` | ✅ Created | none |
| `CapacitorVendor/AparajitaCapacitorBiometricAuth` | ✅ Created | none |
| `CapacitorVendor/CapacitorApp` | ✅ Created | none |
| `CapacitorVendor/CapacitorHaptics` | ✅ Created | none |
| `CapacitorVendor/CapacitorLocalNotifications` | ✅ Created | none |
| `CapacitorVendor/CapacitorPushNotifications` | ✅ Created | none |
| `CapacitorVendor/CapawesomeCapacitorBadge` | ✅ Created | `NSPrivacyAccessedAPICategoryUserDefaults` → `CA92.1` |

## Main App (`ios/App/App/PrivacyInfo.xcprivacy`)

**NSPrivacyTracking:** `false`  
Vercel Analytics is web-only (no cookies, no cross-site tracking, no fingerprinting). The iOS app runs in bundled Capacitor mode and does not load Vercel Analytics.

**NSPrivacyTrackingDomains:** empty

**NSPrivacyCollectedDataTypes:**

| Type | Linked | Tracking | Purpose | Notes |
|------|--------|----------|---------|-------|
| UserID | true | false | AppFunctionality | Supabase UUID |
| Name | true | false | AppFunctionality | screenname |
| EmailAddress | true | false | AppFunctionality | synthetic `@hiitsme.app` address |
| DeviceID | true | false | AppFunctionality | APNs device token |
| OtherUserContent | true | false | AppFunctionality | DMs, room messages, voice notes |
| PhotosOrVideos | true | false | AppFunctionality | avatar images uploaded to Supabase Storage |
| AudioData | true | false | AppFunctionality | voice note recordings |
| ProductInteraction | true | false | AppFunctionality | message reads, room joins, presence |

**NSPrivacyAccessedAPITypes:** empty  
Audit of `ios/App/App/*.swift` and `ios/App/App/AppDelegate.swift` found no calls to UserDefaults, fileTimestamp, systemBootTime, or diskSpace APIs.

## Plugin Audit

### AparajitaCapacitorBiometricAuth
- Source: `ios/Sources/BiometricAuthNative/`
- Uses `LAContext` for Face ID / Touch ID — **not** a required-reason API per Apple's list
- `NSPrivacyAccessedAPITypes`: empty

### CapacitorApp
- Source: `ios/Sources/AppPlugin/`
- Handles app lifecycle events (foreground/background/URL open)
- No required-reason APIs found
- `NSPrivacyAccessedAPITypes`: empty

### CapacitorHaptics
- Source: `ios/Sources/HapticsPlugin/`
- Wraps `UIImpactFeedbackGenerator` and `UINotificationFeedbackGenerator`
- No required-reason APIs found
- `NSPrivacyAccessedAPITypes`: empty

### CapacitorLocalNotifications
- Source: `ios/Sources/LocalNotificationsPlugin/`
- Uses `UNUserNotificationCenter` — not a required-reason API
- No required-reason APIs found
- `NSPrivacyAccessedAPITypes`: empty

### CapacitorPushNotifications
- Source: `ios/Sources/PushNotificationsPlugin/`
- Registers for remote notifications, handles APNs delegate callbacks
- No required-reason APIs found
- `NSPrivacyAccessedAPITypes`: empty

### CapawesomeCapacitorBadge
- Source: `ios/Plugin/`
- `Badge.swift` lines 8–9: `UserDefaults.standard.set(…)` / `UserDefaults.standard.integer(forKey:)`
- **Required reason:** `CA92.1` — "Access info from the same app that wrote it"
- `NSPrivacyAccessedAPITypes`: `NSPrivacyAccessedAPICategoryUserDefaults` → `["CA92.1"]`

## Package.swift Updates

All 6 plugin `Package.swift` files updated to declare `PrivacyInfo.xcprivacy` as a copied resource:

```swift
resources: [.copy("PrivacyInfo.xcprivacy")]
```

This ensures Xcode bundles the manifest into the compiled `.xcframework` / SPM build product and the aggregated privacy report includes it.

## Notes

- `LAContext` (biometric) is **not** in Apple's required-reason API list. No reason code needed.
- `UNUserNotificationCenter` is **not** in Apple's required-reason API list.
- Capacitor framework's own `PrivacyInfo.xcprivacy` is bundled in the `.build` artifacts — no action needed there.
- Re-run this audit whenever a new Capacitor plugin is added or an existing plugin is upgraded.
