import UIKit
import Capacitor

class BoardseshViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Let the native scroll view bounce naturally for smooth scroll physics.
        // CSS overscroll-behavior-y:none on <html> prevents web content from
        // rubber-banding, and Capacitor's backgroundColor (#0A0A0A) ensures
        // any native bounce reveals matching black — not a jarring white.
        // Previously bounces=false was set here, but it degrades momentum
        // scrolling and touch responsiveness vs Safari.

        // If a universal link triggered a cold start, navigate to it now
        // that the bridge and WebView are ready.
        loadPendingUniversalLink()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        // Fallback: the window may not be set during viewDidLoad on first launch.
        // Check again once the view is fully in the hierarchy.
        loadPendingUniversalLink()
    }

    private func loadPendingUniversalLink() {
        guard let sceneDelegate = view.window?.windowScene?.delegate as? SceneDelegate,
              let pendingURL = sceneDelegate.pendingUniversalLinkURL else {
            return
        }
        sceneDelegate.pendingUniversalLinkURL = nil
        webView?.load(URLRequest(url: pendingURL))
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var shouldAutorotate: Bool {
        false
    }
}
