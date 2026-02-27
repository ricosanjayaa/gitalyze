/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import RepoDetail from "./pages/RepoDetail";
import RedirectPage from "./pages/Redirect";
import NotFoundPage from "./pages/NotFound";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard/:username" element={<Dashboard />} />
          <Route path="/repo/:owner/:repoName" element={<RepoDetail />} />
          <Route path="/redirect" element={<RedirectPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
