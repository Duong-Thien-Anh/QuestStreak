import { Routes, Route } from "react-router";
import { useAppStore } from "@/shared/store/useAppStore";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "@/shared/layout/TopBar";
import { BottomNav } from "@/shared/layout/BottomNav";
import { Toast } from "@/shared/components/Toast";
import { TasksPage } from "@/features/tasks/TasksPage";
import { ShopPage } from "@/features/shop/ShopPage";
import { PunishmentsPage } from "@/features/punishments/PunishmentsPage";
import { NotebookPage } from "@/features/notebook/NotebookPage";
import { HouseManagementPage } from "@/features/house/HouseManagementPage";
import Login from "@/features/auth/LoginPage";
import NotFound from "@/features/not-found/NotFoundPage";

function MainApp() {
  const { activeTab, showHouseManagement, toast, clearToast } = useAppStore();

  if (showHouseManagement) {
    return (
      <div className="min-h-screen bg-[#0D0D11] text-white flex flex-col">
        <HouseManagementPage />
        <Toast message={toast?.message || ""} type={toast?.type || "info"} visible={!!toast} onClose={clearToast} />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "tasks":
        return <TasksPage />;
      case "shop":
        return <ShopPage />;
      case "punishments":
        return <PunishmentsPage />;
      case "notebook":
        return <NotebookPage />;
      default:
        return <TasksPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D11] text-white flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20 pt-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
      <Toast
        message={toast?.message || ""}
        type={toast?.type || "info"}
        visible={!!toast}
        onClose={clearToast}
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
