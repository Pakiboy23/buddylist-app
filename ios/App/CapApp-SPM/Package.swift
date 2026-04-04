// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.1.0"),
        .package(name: "AparajitaCapacitorBiometricAuth", path: "../CapacitorVendor/AparajitaCapacitorBiometricAuth"),
        .package(name: "CapacitorHaptics", path: "../CapacitorVendor/CapacitorHaptics"),
        .package(name: "CapacitorLocalNotifications", path: "../CapacitorVendor/CapacitorLocalNotifications"),
        .package(name: "CapacitorPushNotifications", path: "../CapacitorVendor/CapacitorPushNotifications"),
        .package(name: "CapawesomeCapacitorBadge", path: "../CapacitorVendor/CapawesomeCapacitorBadge")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "AparajitaCapacitorBiometricAuth", package: "AparajitaCapacitorBiometricAuth"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapawesomeCapacitorBadge", package: "CapawesomeCapacitorBadge")
            ]
        )
    ]
)
