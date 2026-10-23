plugins {
    id("com.android.application")
}

android {
    namespace = "com.ashenfields.rpg"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ashenfields.rpg"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("release") {
            val ksFile = file("release-keystore.jks")
            if (ksFile.exists()) {
                storeFile = ksFile
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "ashenfields123"
                keyAlias = System.getenv("KEY_ALIAS") ?: "ashenkey"
                keyPassword = System.getenv("KEY_PASSWORD") ?: "ashenfields123"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val ksFile = file("release-keystore.jks")
            signingConfig = if (ksFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // 100% Pure Android SDK (android.app.Activity, android.view.View, android.graphics.Canvas, android.media.AudioTrack)
    // Zero external dependency conflicts
}
