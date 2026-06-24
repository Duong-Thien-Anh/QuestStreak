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
import { InviteJoinPage } from "@/features/auth/InviteJoinPage";
import Login from "@/features/auth/LoginPage";
import DemoLogin from "@/features/auth/DemoLoginPage";
import NotFound from "@/features/not-found/NotFoundPage";
import { trpc } from "@/providers/trpc";

function MainApp() {
  const { activeTab, managementPanel, toast, clearToast } = useAppStore();

  // Detect whether the authenticated user belongs to a house
  const houseQuery = trpc.house.get.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  // While loading, show a minimal spinner so there's no layout flash
  if (houseQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#FF2A85]/40 border-t-[#FF2A85] animate-spin" />
      </div>
    );
  }

  // User authenticated but not a member of any house → invite join flow
  if (houseQuery.isFetched && houseQuery.data === null) {
    return (
      <>
        <InviteJoinPage />
        <Toast
          message={toast?.message || ""}
          type={toast?.type || "info"}
          visible={!!toast}
          onClose={clearToast}
        />
      </>
    );
  }

  if (managementPanel) {
    return (
      <div className="min-h-screen bg-[#0D0D11] text-white flex flex-col">
        <HouseManagementPage />
        <Toast
          message={toast?.message || ""}
          type={toast?.type || "info"}
          visible={!!toast}
          onClose={clearToast}
        />
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
      <Route path="/demo-login" element={<DemoLogin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
