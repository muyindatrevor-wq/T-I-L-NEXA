# Money Manager

A comprehensive Android mobile money management app built with Kotlin.

## Features

- 💰 Track income and expenses
- 📊 View financial analytics and reports
- 💳 Manage multiple accounts
- 🏦 Set budgets and monitor spending
- 📱 Beautiful and intuitive UI

## Tech Stack

- **Language**: Kotlin
- **Architecture**: MVVM with Clean Architecture
- **Database**: Room
- **UI Framework**: Jetpack Compose
- **Dependency Injection**: Hilt
- **Build System**: Gradle

## Project Structure

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/trevor/moneymanager/
│   │   │   ├── data/
│   │   │   │   └── models/
│   │   │   ├── domain/
│   │   │   ├── presentation/
│   │   │   └── MainActivity.kt
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── test/
├── build.gradle.kts
└── proguard-rules.pro
```

## Getting Started

1. Clone the repository
   ```bash
   git clone https://github.com/muyindatrevor-wq/money-manager.git
   ```

2. Open in Android Studio (latest version recommended)

3. Sync Gradle files

4. Build and run on an emulator or physical device

## Key Modules

### Data Layer
- **Models**: Transaction, Account, Budget
- **Room Database**: Local data persistence
- **DAOs**: Database access objects

### Domain Layer
- **Use Cases**: Business logic
- **Repositories**: Data abstraction

### Presentation Layer
- **ViewModels**: UI state management
- **Composables**: Jetpack Compose UI components
- **Screens**: Main app screens

## Development

Contributions are welcome! Please:
1. Create a feature branch
2. Commit your changes
3. Push to the branch
4. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial use.
