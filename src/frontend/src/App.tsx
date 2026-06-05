import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import FaceScanPage from "@/pages/FaceScanPage";
import RegisterPage from "@/pages/RegisterPage";
import SettingsPage from "@/pages/SettingsPage";
import type { Tab } from "@/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const queryClient = new QueryClient();

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem("faceattend-active-tab");
    const valid: Tab[] = ["scan", "register", "dashboard", "settings"];
    return valid.includes(saved as Tab) ? (saved as Tab) : "scan";
  });

  const handleSetTab = (tab: Tab) => {
    setActiveTab(tab);
    localStorage.setItem("faceattend-active-tab", tab);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleSetTab}>
      {activeTab === "scan" && <FaceScanPage />}
      {activeTab === "register" && <RegisterPage />}
      {activeTab === "dashboard" && <DashboardPage />}
      {activeTab === "settings" && <SettingsPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
