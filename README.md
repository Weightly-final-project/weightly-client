# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

### Install dependencies

   ```bash
   npm install
   ```

### Start the app

   ```bash
    npx expo start
   ```

### build app

#### android
   ##### for windows
   make sure the path of your project isn't to long i recommand puting the project at c drive and changing the name to somthing short like client
   ##### prebuild
   ```bash
   npx expo prebuild -p android
   ```
   ##### create keystore
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore android\app\weightly-client.keystore -alias WeightlyClientKey -keyalg RSA -keysize 2048 -validity 10000 -storepass WeightlyStorePass1234 -keypass WeightlyStorePass1234 -dname "CN=Weightly-client, OU=IL, O=Weightly, L=Tel Aviv, ST=IL, C=IL"
   ```

   ##### config keystore

   edit in the end of android/gradle.properties add those line
   ```bash
   MYAPP_RELEASE_STORE_FILE=weightly-client.keystore
   MYAPP_RELEASE_KEY_ALIAS=WeightlyClientKey
   MYAPP_RELEASE_STORE_PASSWORD=WeightlyStorePass1234
   MYAPP_RELEASE_KEY_PASSWORD=WeightlyStorePass1234
   ```

   make sure that MYAPP_RELEASE_STORE_PASSWORD and MYAPP_RELEASE_KEY_PASSWORD are matching the password you put in -storepass and -keypass and that -storepass are the same as -keypass.

   edit android/app/build.gradel
   add this to it
   ```json
   android {
      // keep the same
      signingConfigs {
        debug {
         // keep the same
        }
        // add this
        release {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        }
      }
      buildTypes {
        debug {
            // keep the same
        }
        // add this
        release {
            signingConfig signingConfigs.release
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            crunchPngs (findProperty('android.enablePngCrunchInReleaseBuilds')?.toBoolean() ?: true)
        }
      }
   }
   ```

   ##### runing build

   ```bash
   cd android
   .\gradlew clean assembleRelease 
   ```

   ##### apk directory
   ```bash
   cd android/app/build/outputs/apk/release/app-release.apk
   ```

   

