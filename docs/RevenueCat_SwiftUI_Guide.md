# RevenueCat Integration Guide for SwiftUI

This guide provides step-by-step instructions to integrate RevenueCat into a SwiftUI app using Swift Package Manager (SPM).

## 1. Install RevenueCat SDK via SPM

1. Open your Xcode project.
2. Go to **File > Add Package Dependencies...**
3. Enter the package URL: `https://github.com/RevenueCat/purchases-ios-spm.git`
4. Click **Add Package**.
5. Select `RevenueCat` and `RevenueCatUI` (for Paywalls) and click **Add Package**.

## 2. Configure SDK

In your `App` struct (e.g., `FocusApp.swift`), configure the SDK with your API Key.

```swift
import SwiftUI
import RevenueCat
import RevenueCatUI

@main
struct FocusApp: App {
    init() {
        Purchases.logLevel = .debug
        Purchases.configure(withAPIKey: "test_IJBHtoaIScDEBRjltWDVlgckOhG")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## 3. Subscription Functionality (ContentView)

Use `RevenueCatUI` to present a Paywall if the user is not entitled.

```swift
import SwiftUI
import RevenueCat
import RevenueCatUI

struct ContentView: View {
    // Basic state to track entitlement
    @State private var isPro = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                if isPro {
                    ProContentView()
                } else {
                    FreeContentView()
                }
            }
            .navigationTitle("Focus App")
            .task {
                await checkEntitlement()
            }
            .sheet(isPresented: .constant(!isPro)) {
                PaywallView(displayCloseButton: false)
                    .onPurchaseCompleted { customerInfo in
                        if customerInfo.entitlements["Focus App Pro"]?.isActive == true {
                             isPro = true
                        }
                    }
            }
        }
    }

    func checkEntitlement() async {
        do {
            let customerInfo = try await Purchases.shared.customerInfo()
            if customerInfo.entitlements["Focus App Pro"]?.isActive == true {
                isPro = true
            }
        } catch {
            print("Error fetching customer info: \(error)")
        }
    }
}
```

## 4. Entitlement Checking

The logic above checks for the specific entitlement `Focus App Pro`.

```swift
if customerInfo.entitlements["Focus App Pro"]?.isActive == true {
    // User is Pro
}
```

## 5. Paywalls & Customer Center

`RevenueCatUI` provides ready-to-use views.

### Paywall
Default Paywall (configured in Dashboard):
```swift
PaywallView()
```

### Customer Center
To allow users to manage their subscription:
```swift
.sheet(isPresented: $showCustomerCenter) {
    CustomerCenterView()
}
```

## 6. Product Configuration

Ensure your products are configured in the RevenueCat Dashboard:
- **Identifier**: `monthly` -> Apple Product ID: `com.focusapp.monthly`
- **Identifier**: `yearly` -> Apple Product ID: `com.focusapp.yearly`
- **Identifier**: `lifetime` -> Apple Product ID: `com.focusapp.lifetime`

Add these products to an **Offering** (e.g., "Default") in the RevenueCat Dashboard. The SDK will automatically fetch the "Current" offering.

## 7. Best Practices
- **Restore Purchases**: Add a restore button (often included in standard PaywallView).
- **Listeners**: Listen to `Purchases.shared.customerInfoStream` for real-time updates.

```swift
.task {
    for await customerInfo in Purchases.shared.customerInfoStream {
        isPro = customerInfo.entitlements["Focus App Pro"]?.isActive == true
    }
}
```
