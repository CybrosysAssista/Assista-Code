<div align="center">
<sub>

<b>English</b> • [Català](locales/ca/README.md) • [Deutsch](locales/de/README.md) • [Español](locales/es/README.md) • [Français](locales/fr/README.md) • [हिंदी](locales/hi/README.md) • [Bahasa Indonesia](locales/id/README.md) • [Italiano](locales/it/README.md) • [日本語](locales/ja/README.md)

</sub>
<sub>

[한국어](locales/ko/README.md) • [Nederlands](locales/nl/README.md) • [Polski](locales/pl/README.md) • [Português (BR)](locales/pt-BR/README.md) • [Русский](locales/ru/README.md) • [Türkçe](locales/tr/README.md) • [Tiếng Việt](locales/vi/README.md) • [简体中文](locales/zh-CN/README.md) • [繁體中文](locales/zh-TW/README.md)

</sub>
</div>
<br>
<div align="center">
  <h1>Cybrosys Assista</h1>
  <!-- <img src="https://media.githubusercontent.com/media/CybrosysAssista/Assista/main/src/assets/docs/demo.gif" width="100%" /> -->
  <p>Connect with developers, contribute ideas, and stay ahead with the latest AI-powered coding tools.</p>
</div>
<br>
<br>

<div align="center">

<a href="https://docs.cybrosysassista.com" target="_blank"><img src="https://img.shields.io/badge/Documentation-6B46C1?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Documentation"></a>

</div>

**Cybrosys Assista** is an AI-powered **autonomous coding agent** that lives in your editor. It can:

- Communicate in natural language
- Read and write files directly in your workspace
- Run terminal commands
- Automate browser actions
- Integrate with any OpenAI-compatible or custom API/model
- Adapt its "personality" and capabilities through **Custom Modes**

Whether you're seeking a flexible coding partner, a system architect, or specialized roles like a QA engineer or product manager, Cybrosys Assista can help you build software more efficiently.

Check out the [CHANGELOG](CHANGELOG.md) for detailed updates and fixes.

---


## What Can Cybrosys Assista Do?

- 🚀 **Generate Code** from natural language descriptions
- 🔧 **Refactor & Debug** existing code
- 📝 **Write & Update** documentation
- 🤔 **Answer Questions** about your codebase
- 🔄 **Automate** repetitive tasks
- 🏗️ **Create** new files and projects

## Quick Start

1. [Install Cybrosys Assista](https://docs.cybrosysassista.com/getting-started/installing)
2. [Connect Your AI Provider](https://docs.cybrosysassista.com/getting-started/connecting-api-provider)
3. [Try Your First Task](https://docs.cybrosysassista.com/getting-started/your-first-task)

## Key Features

### Multiple Modes

Cybrosys Assista adapts to your needs with specialized [modes](https://docs.cybrosysassista.com/basic-usage/using-modes):

- **Code Mode:** For general-purpose coding tasks
- **Architect Mode:** For planning and technical leadership
- **Ask Mode:** For answering questions and providing information
- **Debug Mode:** For systematic problem diagnosis
- **[Custom Modes](https://docs.cybrosysassista.com/advanced-usage/custom-modes):** Create unlimited specialized personas for security auditing, performance optimization, documentation, or any other task

### Smart Tools

Cybrosys Assista comes with powerful [tools](https://docs.cybrosysassista.com/basic-usage/how-tools-work) that can:

- Read and write files in your project
- Execute commands in your VS Code terminal
- Control a web browser
- Use external tools via [MCP (Model Context Protocol)](https://docs.cybrosysassista.com/advanced-usage/mcp)

MCP extends Cybrosys Assista's capabilities by allowing you to add unlimited custom tools. Integrate with external APIs, connect to databases, or create specialized development tools - MCP provides the framework to expand Cybrosys Assista's functionality to meet your specific needs.

### Customization

Make Cybrosys Assista work your way with:

- [Custom Instructions](https://docs.cybrosysassista.com/advanced-usage/custom-instructions) for personalized behavior
- [Custom Modes](https://docs.cybrosysassista.com/advanced-usage/custom-modes) for specialized tasks
- [Local Models](https://docs.cybrosysassista.com/advanced-usage/local-models) for offline use
- [Auto-Approval Settings](https://docs.cybrosysassista.com/advanced-usage/auto-approving-actions) for faster workflows

## Resources

### Documentation

- [Basic Usage Guide](https://docs.cybrosysassista.com/basic-usage/the-chat-interface)
- [Advanced Features](https://docs.cybrosysassista.com/advanced-usage/auto-approving-actions)
- [Frequently Asked Questions](https://docs.cybrosysassista.com/faq)

### Community

- **GitHub:** Report [issues](https://github.com/CybrosysAssista/Assista/issues) or request [features](https://github.com/CybrosysAssista/Assista/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Local Setup & Development

1. **Clone** the repo:

```sh
git clone https://github.com/CybrosysAssista/Assista.git
```

2. **Install dependencies**:

```sh
pnpm install
```

3. **Run the extension**:

Press `F5` (or **Run** → **Start Debugging**) in VSCode to open a new window with Cybrosys Assista running.

Changes to the webview will appear immediately. Changes to the core extension will require a restart of the extension host.

Alternatively you can build a .vsix and install it directly in VSCode:

```sh
pnpm vsix
```

A `.vsix` file will appear in the `bin/` directory which can be installed with:

```sh
code --install-extension bin/cybrosys-assista-<version>.vsix
```

We use [changesets](https://github.com/changesets/changesets) for versioning and publishing. Check our `CHANGELOG.md` for release notes.

---

## Disclaimer

**Please note** that Cybrosys Assista, Inc does **not** make any representations or warranties regarding any code, models, or other tools provided or made available in connection with Cybrosys Assista, any associated third-party tools, or any resulting outputs. You assume **all risks** associated with the use of any such tools or outputs; such tools are provided on an **"AS IS"** and **"AS AVAILABLE"** basis. Such risks may include, without limitation, intellectual property infringement, cyber vulnerabilities or attacks, bias, inaccuracies, errors, defects, viruses, downtime, property loss or damage, and/or personal injury. You are solely responsible for your use of any such tools or outputs (including, without limitation, the legality, appropriateness, and results thereof).

---

## License

[Apache 2.0 © 2025 Cybrosys Assista, Inc.](./LICENSE)

---

## Contributing

We welcome contributions to Cybrosys Assista! If you'd like to help improve the project, please read our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and how to get started.

**Enjoy Cybrosys Assista!** Whether you keep it on a short leash or let it roam autonomously, we can't wait to see what you build. If you have questions or feature ideas, drop by our [Reddit community](https://www.reddit.com/r/CybrosysAssista/) or [Discord](https://discord.gg/cybrosysassista). Happy coding!
