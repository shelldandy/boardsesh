import UIKit
import Capacitor
import Network
import WebKit

final class NetworkStatus {
    static let shared = NetworkStatus()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.boardsesh.network-monitor")
    private(set) var isOnline = true

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isOnline = path.status == .satisfied
        }
        monitor.start(queue: queue)
    }
}

class BoardseshViewController: CAPBridgeViewController {
    private var attemptedCacheFallback = false
    private var mainFrameLoadHadError = false
    private var lastFailedURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Disable rubber-band bounce so the page cannot overscroll
        webView?.scrollView.bounces = false

        // Start monitor eagerly so offline decisions have recent connectivity state.
        _ = NetworkStatus.shared
    }

    override func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        mainFrameLoadHadError = false
        super.webView(webView, didStartProvisionalNavigation: navigation)
    }

    override func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if !mainFrameLoadHadError {
            attemptedCacheFallback = false
            lastFailedURL = nil
        }

        super.webView(webView, didFinish: navigation)
    }

    override func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        mainFrameLoadHadError = true
        if shouldTriggerOfflineFallback(error: error) {
            lastFailedURL = webView.url ?? lastFailedURL
            tryCacheThenFallback(webView)
        }

        super.webView(webView, didFail: navigation, withError: error)
    }

    override func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        mainFrameLoadHadError = true
        if shouldTriggerOfflineFallback(error: error) {
            lastFailedURL = webView.url ?? lastFailedURL
            tryCacheThenFallback(webView)
        }

        super.webView(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    private func shouldTriggerOfflineFallback(error: Error) -> Bool {
        guard !NetworkStatus.shared.isOnline else {
            return false
        }

        let nsError = error as NSError
        guard nsError.domain == NSURLErrorDomain,
              let code = URLError.Code(rawValue: nsError.code)
        else {
            return false
        }

        switch code {
        case .notConnectedToInternet,
             .networkConnectionLost,
             .timedOut,
             .cannotFindHost,
             .cannotConnectToHost,
             .dnsLookupFailed,
             .internationalRoamingOff,
             .callIsActive,
             .dataNotAllowed:
            return true
        default:
            return false
        }
    }

    private func tryCacheThenFallback(_ webView: WKWebView) {
        let targetURL = lastFailedURL ?? webView.url ?? URL(string: "https://boardsesh.com")

        if !attemptedCacheFallback {
            attemptedCacheFallback = true

            if let targetURL {
                let request = URLRequest(
                    url: targetURL,
                    cachePolicy: .returnCacheDataElseLoad,
                    timeoutInterval: 30
                )
                webView.load(request)
            }
            return
        }

        let safeURL = htmlEscaped(targetURL?.absoluteString ?? "https://boardsesh.com")
        let errorHtml = """
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset='utf-8' />
            <meta name='viewport' content='width=device-width, initial-scale=1' />
            <title>You're offline</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0A0A0A;
                color: #fff;
                margin: 0;
                padding: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
              }
              main { max-width: 360px; }
              h1 { font-size: 24px; margin: 0 0 12px; }
              p { color: #c4c4c4; line-height: 1.5; }
              a {
                display: inline-block;
                margin-top: 8px;
                padding: 10px 14px;
                border-radius: 10px;
                background: #fff;
                color: #0A0A0A;
                text-decoration: none;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>You appear to be offline</h1>
              <p>We couldn't load Boardsesh from the network and no cached version was available yet. Check your connection and try again.</p>
              <p><a href='\(safeURL)'>Try again</a></p>
            </main>
          </body>
        </html>
        """

        webView.loadHTMLString(errorHtml, baseURL: nil)
    }

    private func htmlEscaped(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
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
