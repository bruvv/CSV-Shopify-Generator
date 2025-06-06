# CSV Shopify Generator

This repository contains a Next.js application for converting Magento export files into Shopify‑compatible CSVs. Customers and products can be imported from Magento CSVs or entered manually through the web interface. All data is validated to meet Shopify’s import requirements and can be downloaded as a ready‑to‑use CSV.

## Core Features

- Upload Magento CSV files for customers and products and convert them to the Shopify format.
- Manual entry forms with automatic validation.
- Supports multiple entries and bulk editing.
- Download the generated Shopify CSV file directly from the UI.

## Style Guidelines

- Built with ShadCN UI components and standard Next.js structure.
- Primary color: deep teal (`#008080`).
- Background color: light cyan (`#E0FFFF`).
- Accent color: forest green (`#228B22`).
- Entire project is written in TypeScript.

## Getting Started

Follow these steps to run the project locally:

1. **Clone the repository**

   ```bash
   git clone <repository_url>
   cd CSV-Shopify-Generator
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server**

   The server runs on port `9002` by default.

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open in your browser**

   Navigate to `http://localhost:9002` to view the application.
