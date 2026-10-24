# Contributing to SOILUTIONISTS

We welcome contributions, bug reports, and research enhancements to the **Full-Stack Agronomic Smart Field Manager** project!

---

## 🌾 How to Contribute

1. **Fork the Repository:** Create your own branch (`git checkout -b feature/crop-profile-enhancement`).
2. **Firmware Contributions:**
   - Adhere to the memory constraints of the ESP32.
   - Always verify CRC-16 on Modbus communication.
   - Maintain static memory allocation (`StaticJsonDocument`) to prevent heap fragmentation.
3. **Web Dashboard Contributions:**
   - Ensure responsive layout across desktop, tablet, and mobile browsers.
   - Keep styles consistent with the modern design system in `web/css/style.css`.
   - Test both **Live Firebase Mode** and **Simulation Mode**.
4. **Documentation & Research:**
   - Cite relevant agronomy studies and maintain mathematical notation standards.
5. **Submit a Pull Request:** Describe your changes in detail, link any open issues, and verify that the simulation mode operates smoothly.

---

## 📜 Code of Conduct
Please maintain a respectful, constructive, and collaborative environment. All contributors are expected to uphold academic integrity and open-source best practices.
