package com.venom.dpbot

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

/**
 * VENOM DP Bot — Android wrapper.
 *
 * This app shows your hosted bot website inside a full-screen WebView.
 * The Node.js bot server must be running somewhere reachable (Render,
 * Railway, Codespaces port-forward, …) — put its https URL in SERVER_URL.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Photo picker result -> back to the WebView's file input.
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris: Array<Uri>? =
                if (result.resultCode == Activity.RESULT_OK) {
                    result.data?.let { data ->
                        data.clipData?.let { clip ->
                            Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                        } ?: data.data?.let { arrayOf(it) }
                    }
                } else null
            filePathCallback?.onReceiveValue(uris)
            filePathCallback = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge so the cyber UI fills the whole screen.
        WindowCompat.setDecorFitsSystemWindows(window, false)

        webView = WebView(this)
        setContentView(webView)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
        }
        webView.webViewClient = WebViewClient() // stay inside the app

        webView.webChromeClient = object : WebChromeClient() {
            // Lets the site's "choose a photo" button open the Android picker.
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = params?.createIntent() ?: run {
                    filePathCallback = null
                    return false
                }
                return try {
                    fileChooserLauncher.launch(intent)
                    true
                } catch (e: Exception) {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = null
                    false
                }
            }
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(SERVER_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    @Deprecated("Back goes to WebView history first")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    companion object {
        /**
         * 👉 PUT YOUR DEPLOYED SITE URL HERE, e.g.
         * "https://venom-dp-bot.onrender.com"
         * (must be https and reachable from the phone)
         */
        const val SERVER_URL = "https://your-server-url-here.example.com"
    }
}
