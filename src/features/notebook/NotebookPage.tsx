import { useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import { motion } from "framer-motion";
import {
  Lock,
  Heart,
  BookOpen,
  StickyNote,
  ChevronRight,
  Plus,
  FileSignature,
} from "lucide-react";
import { FAB } from "@/shared/components/FAB";
import {
  mockLimits,
  mockDesires,
  mockJournals,
  mockNotes,
  moodEmojis,
} from "@/shared/mockData/mockData";

interface Agreement {
  id: number;
  houseId: number;
  title: string;
  purpose: string;
  rules: string;
  consequences: string;
  domSignature: boolean;
  subSignature: boolean;
  status: "pending" | "active" | "void";
  domSignedAt: Date | undefined;
  subSignedAt: Date | undefined;
}

export function NotebookPage() {
  const { mockSystemRole, showToast } = useAppStore();
  const isAdmin = mockSystemRole === "admin";
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [limits, setLimits] = useState(mockLimits);
  const [desires, setDesires] = useState(mockDesires);
  const [agreements, setAgreements] = useState<Agreement[]>([
    {
      id: 1,
      houseId: 1,
      title: "Thoa thuan co ban",
      purpose: "Thiet lap quy tac co ban cho moi quan he",
      rules: '[{"rule":"Ton trong gioi han cua nhau","context":"Khong ep buoc vuot qua limit"},{"rule":"Bao cao trung thuc","context":"Khong noi doi ve task"}]',
      consequences: '[{"trigger":"Vi pham quy tac","action":"Them 5 Chay"}]',
      domSignature: true,
      subSignature: true,
      status: "active",
      domSignedAt: new Date(),
      subSignedAt: new Date(),
    },
  ]);
  const [journals, setJournals] = useState(mockJournals);
  const [notes, setNotes] = useState<
    { id: number; houseId: number; memberId: number; title: string; content: string; visibility: "public" | "private" }[]
  >(mockNotes);

  // Form states
  const [newLimit, setNewLimit] = useState("");
  const [newDesire, setNewDesire] = useState("");
  const [newNote, setNewNote] = useState<{ title: string; content: string; visibility: "public" | "private" }>({ title: "", content: "", visibility: "private" });
  const [newJournal, setNewJournal] = useState({ name: "", prompt: "" });
  const [newJournalEntry, setNewJournalEntry] = useState({ mood: "happy" as const, content: "" });
  const [selectedJournal, setSelectedJournal] = useState<number | null>(null);
  const [newAgreement, setNewAgreement] = useState({ title: "", purpose: "", rules: "", consequences: "" });

  const handleAddLimit = () => {
    if (!newLimit.trim()) return;
    setLimits([...limits, { id: Date.now(), houseId: 1, content: newLimit, type: "limit" as const }]);
    setNewLimit("");
    showToast("Đã thêm giới hạn!", "success");
  };

  const handleAddDesire = () => {
    if (!newDesire.trim()) return;
    setDesires([...desires, { id: Date.now(), houseId: 1, content: newDesire, type: "desire" as const }]);
    setNewDesire("");
    showToast("Đã thêm mong muốn!", "success");
  };

  const handleAddNote = () => {
    if (!newNote.title.trim()) return;
    setNotes([...notes, { id: Date.now(), houseId: 1, memberId: 1, title: newNote.title, content: newNote.content, visibility: newNote.visibility as "public" | "private" }]);
    setNewNote({ title: "", content: "", visibility: "private" });
    showToast("Da them ghi chu!", "success");
  };

  const handleAddJournal = () => {
    if (!newJournal.name.trim()) return;
    setJournals([...journals, { id: Date.now(), houseId: 1, memberId: 2, ...newJournal, entries: [] }]);
    setNewJournal({ name: "", prompt: "" });
    showToast("Đã tạo nhật ký!", "success");
  };

  const handleAddJournalEntry = () => {
    if (!newJournalEntry.content.trim() || !selectedJournal) return;
    setJournals((prev) =>
      prev.map((j) => {
        if (j.id !== selectedJournal) return j;
        return {
          ...j,
          entries: [
            ...j.entries,
            {
              id: Date.now(),
              journalId: selectedJournal,
              memberId: 2,
              mood: newJournalEntry.mood,
              content: newJournalEntry.content,
              createdAt: new Date(),
            },
          ],
        };
      })
    );
    setNewJournalEntry({ mood: "happy", content: "" });
    showToast("Đã thêm bài viết!", "success");
  };

  const handleCreateAgreement = () => {
    if (!newAgreement.title.trim()) return;
    const newAg: Agreement = {
      id: Date.now(),
      houseId: 1,
      title: newAgreement.title,
      purpose: newAgreement.purpose,
      rules: newAgreement.rules,
      consequences: newAgreement.consequences,
      domSignature: false,
      subSignature: false,
      status: "pending",
      domSignedAt: undefined,
      subSignedAt: undefined,
    };
    setAgreements([...agreements, newAg]);
    setNewAgreement({ title: "", purpose: "", rules: "", consequences: "" });
    showToast("Da tao thoa thuan!", "success");
  };

  const handleSignAgreement = (id: number, as: "dom" | "sub") => {
    setAgreements((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const domSignature = as === "dom" ? true : a.domSignature;
        const subSignature = as === "sub" ? true : a.subSignature;
        const domSignedAt = as === "dom" ? new Date() : a.domSignedAt;
        const subSignedAt = as === "sub" ? new Date() : a.subSignedAt;
        const status: "pending" | "active" | "void" = domSignature && subSignature ? "active" : "pending";
        return {
          ...a,
          domSignature,
          subSignature,
          domSignedAt,
          subSignedAt,
          status,
        };
      })
    );
    showToast("Da ky thoa thuan!", "success");
  };

  // Overview Screen
  if (!activeSection) {
    return (
      <div className="px-4 pt-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Limits &amp; Desires
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => setActiveSection("limits")}
              className="w-full flex items-center gap-4 p-4 bg-[#1A1A22] rounded-xl border border-white/5 hover:border-[#FF3B30]/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#FF3B30]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white text-sm">Limits</h3>
                <p className="text-xs text-white/50">What&apos;s off the table</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>

            <button
              onClick={() => setActiveSection("desires")}
              className="w-full flex items-center gap-4 p-4 bg-[#1A1A22] rounded-xl border border-white/5 hover:border-[#FF2A85]/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF2A85]/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-[#FF2A85]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white text-sm">Desires</h3>
                <p className="text-xs text-white/50">What you&apos;re into</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Agreements
          </h2>
          <button
            onClick={() => setActiveSection("agreements")}
            className="w-full flex items-center gap-4 p-4 bg-[#1A1A22] rounded-xl border border-white/5 hover:border-[#00F2FE]/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#00F2FE]/10 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-[#00F2FE]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">
                Agreements ({agreements.length})
              </h3>
              <p className="text-xs text-white/50">
                {agreements.filter((a) => a.status === "active").length} active
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Journal
          </h2>
          <button
            onClick={() => setActiveSection("journals")}
            className="w-full flex items-center gap-4 p-4 bg-[#1A1A22] rounded-xl border border-white/5 hover:border-[#A155FF]/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#A155FF]/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#A155FF]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">
                Journals ({journals.length})
              </h3>
              <p className="text-xs text-white/50">Track your feelings</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Notes
          </h2>
          <button
            onClick={() => setActiveSection("notes")}
            className="w-full flex items-center gap-4 p-4 bg-[#1A1A22] rounded-xl border border-white/5 hover:border-[#FFD700]/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center">
              <StickyNote className="w-5 h-5 text-[#FFD700]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">
                Notes ({notes.length})
              </h3>
              <p className="text-xs text-white/50">List · {notes.length} items</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </button>
        </motion.div>

        <FAB
          actions={[
            {
              label: "New Agreement",
              icon: <FileSignature className="w-5 h-5 text-white" />,
              onClick: () => setActiveSection("newAgreement"),
              color: "#00F2FE",
            },
            {
              label: "New Journal",
              icon: <BookOpen className="w-5 h-5 text-white" />,
              onClick: () => setActiveSection("newJournal"),
              color: "#A155FF",
            },
            {
              label: "New Note",
              icon: <StickyNote className="w-5 h-5 text-white" />,
              onClick: () => setActiveSection("newNote"),
              color: "#FF2A85",
            },
          ]}
        />
      </div>
    );
  }

  // Detail Sections
  return (
    <div className="px-4 pt-4">
      <button
        onClick={() => setActiveSection(null)}
        className="flex items-center gap-2 mb-4 text-sm text-white/60 hover:text-white transition-colors"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back
      </button>

      {/* Limits Section */}
      {activeSection === "limits" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Limits</h2>
          <div className="space-y-2">
            {limits.map((limit) => (
              <div
                key={limit.id}
                className="flex items-center gap-3 p-3 bg-[#1A1A22] rounded-xl border border-[#FF3B30]/20"
              >
                <Lock className="w-4 h-4 text-[#FF3B30] flex-shrink-0" />
                <span className="text-sm text-white/80">{limit.content}</span>
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                placeholder="Add a new limit..."
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF3B30]/50 focus:outline-none"
              />
              <button
                onClick={handleAddLimit}
                className="w-full py-3 rounded-xl bg-[#FF3B30] text-white font-semibold text-sm hover:bg-[#FF3B30]/90 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Limit
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Desires Section */}
      {activeSection === "desires" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Desires</h2>
          <p className="text-sm text-white/50 mb-4 italic">
            Tell them what you&apos;re into, without having to say it out loud.
          </p>
          <div className="space-y-2">
            {desires.map((desire) => (
              <div
                key={desire.id}
                className="flex items-center gap-3 p-3 bg-[#1A1A22] rounded-xl border border-[#FF2A85]/20"
              >
                <Heart className="w-4 h-4 text-[#FF2A85] flex-shrink-0" />
                <span className="text-sm text-white/80">{desire.content}</span>
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={newDesire}
                onChange={(e) => setNewDesire(e.target.value)}
                placeholder="Add a desire..."
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
              />
              <button
                onClick={handleAddDesire}
                className="w-full py-3 rounded-xl bg-[#FF2A85] text-white font-semibold text-sm hover:bg-[#FF2A85]/90 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Desire
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Agreements Section */}
      {activeSection === "agreements" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Agreements</h2>
          <div className="space-y-3">
            {agreements.map((agreement) => (
              <div
                key={agreement.id}
                className="bg-[#1A1A22] rounded-xl border border-white/5 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white text-sm">
                    {agreement.title}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      agreement.status === "active"
                        ? "bg-[#00F2FE]/10 text-[#00F2FE]"
                        : agreement.status === "pending"
                        ? "bg-[#FFD700]/10 text-[#FFD700]"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {agreement.status.toUpperCase()}
                  </span>
                </div>
                {agreement.purpose && (
                  <p className="text-xs text-white/50 mb-3">{agreement.purpose}</p>
                )}
                {/* Signatures */}
                <div className="flex gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        agreement.domSignature
                          ? "bg-[#A155FF]/20 text-[#A155FF]"
                          : "bg-white/5 text-white/20"
                      }`}
                    >
                      D
                    </div>
                    <span className="text-xs text-white/40">Dom</span>
                    {agreement.domSignature && (
                      <FileSignature className="w-3 h-3 text-[#A155FF]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        agreement.subSignature
                          ? "bg-[#FF2A85]/20 text-[#FF2A85]"
                          : "bg-white/5 text-white/20"
                      }`}
                    >
                      S
                    </div>
                    <span className="text-xs text-white/40">Sub</span>
                    {agreement.subSignature && (
                      <FileSignature className="w-3 h-3 text-[#FF2A85]" />
                    )}
                  </div>
                </div>
                {/* Sign buttons for pending */}
                {agreement.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    {!agreement.domSignature && (
                      <button
                        onClick={() => handleSignAgreement(agreement.id, "dom")}
                        className="flex-1 py-2 rounded-lg bg-[#A155FF]/10 text-[#A155FF] text-xs font-medium hover:bg-[#A155FF]/20 transition-colors"
                      >
                        Sign as Dom
                      </button>
                    )}
                    {!agreement.subSignature && (
                      <button
                        onClick={() => handleSignAgreement(agreement.id, "sub")}
                        className="flex-1 py-2 rounded-lg bg-[#FF2A85]/10 text-[#FF2A85] text-xs font-medium hover:bg-[#FF2A85]/20 transition-colors"
                      >
                        Sign as Sub
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Journals Section */}
      {activeSection === "journals" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Journals</h2>
          <div className="space-y-3">
            {journals.map((journal) => (
              <button
                key={journal.id}
                onClick={() => setSelectedJournal(selectedJournal === journal.id ? null : journal.id)}
                className="w-full text-left bg-[#1A1A22] rounded-xl border border-white/5 p-4 hover:border-[#A155FF]/30 transition-colors"
              >
                <h3 className="font-semibold text-white text-sm">{journal.name}</h3>
                {journal.prompt && (
                  <p className="text-xs text-white/50 mt-1">{journal.prompt}</p>
                )}
                <p className="text-xs text-white/30 mt-1">
                  {journal.entries.length} entries
                </p>
                {/* Show entries if expanded */}
                {selectedJournal === journal.id && (
                  <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    {journal.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg bg-[#252532] border border-white/5"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {moodEmojis[entry.mood]?.emoji}
                          </span>
                          <span
                            className="text-[10px] font-medium"
                            style={{
                              color: moodEmojis[entry.mood]?.color || "#fff",
                            }}
                          >
                            {moodEmojis[entry.mood]?.label}
                          </span>
                        </div>
                        <p className="text-xs text-white/70">{entry.content}</p>
                      </div>
                    ))}
                    {/* Add entry form */}
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        {Object.entries(moodEmojis).map(([key, value]) => (
                          <button
                            key={key}
                            onClick={() =>
                              setNewJournalEntry((prev) => ({ ...prev, mood: key as typeof prev.mood }))
                            }
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${
                              newJournalEntry.mood === key
                                ? "bg-white/10 ring-2 ring-[#A155FF]"
                                : "hover:bg-white/5"
                            }`}
                          >
                            {value.emoji}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={newJournalEntry.content}
                        onChange={(e) =>
                          setNewJournalEntry((prev) => ({ ...prev, content: e.target.value }))
                        }
                        placeholder="Write your thoughts..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-[#252532] border border-white/10 text-white text-xs placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none resize-none"
                      />
                      <button
                        onClick={handleAddJournalEntry}
                        className="w-full py-2 rounded-lg bg-[#A155FF] text-white text-xs font-medium hover:bg-[#A155FF]/90 transition-colors"
                      >
                        Add Entry
                      </button>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notes Section */}
      {activeSection === "notes" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Notes</h2>
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-[#1A1A22] rounded-xl border border-white/5 p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-white text-sm">{note.title}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      note.visibility === "public"
                        ? "bg-[#00F2FE]/10 text-[#00F2FE]"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {note.visibility}
                  </span>
                </div>
                <p className="text-xs text-white/50">{note.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* New Agreement Form */}
      {activeSection === "newAgreement" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h2 className="text-lg font-semibold text-white">New Agreement</h2>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Title</label>
            <input
              type="text"
              value={newAgreement.title}
              onChange={(e) => setNewAgreement((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Protocol Agreement"
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Purpose</label>
            <textarea
              value={newAgreement.purpose}
              onChange={(e) => setNewAgreement((prev) => ({ ...prev, purpose: e.target.value }))}
              placeholder="What are you choosing together?"
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Rules (one per line)</label>
            <textarea
              value={newAgreement.rules}
              onChange={(e) => setNewAgreement((prev) => ({ ...prev, rules: e.target.value }))}
              placeholder="e.g., No orgasm without permission..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={handleCreateAgreement}
            className="w-full py-3 rounded-xl bg-[#00F2FE] text-[#0D0D11] font-semibold text-sm hover:bg-[#00F2FE]/90 transition-colors"
          >
            Create Agreement
          </button>
        </motion.div>
      )}

      {/* New Journal Form */}
      {activeSection === "newJournal" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h2 className="text-lg font-semibold text-white">New Journal</h2>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Name</label>
            <input
              type="text"
              value={newJournal.name}
              onChange={(e) => setNewJournal((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="My Journal"
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Prompt</label>
            <textarea
              value={newJournal.prompt}
              onChange={(e) => setNewJournal((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder="What should your taskee write about?"
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={handleAddJournal}
            className="w-full py-3 rounded-xl bg-[#A155FF] text-white font-semibold text-sm hover:bg-[#A155FF]/90 transition-colors"
          >
            Create Journal
          </button>
        </motion.div>
      )}

      {/* New Note Form */}
      {activeSection === "newNote" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h2 className="text-lg font-semibold text-white">New Note</h2>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Title</label>
            <input
              type="text"
              value={newNote.title}
              onChange={(e) => setNewNote((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Note title..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Content</label>
            <textarea
              value={newNote.content}
              onChange={(e) => setNewNote((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Write your note..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Visibility</label>
            <div className="flex gap-2">
              {(["public", "private"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setNewNote((prev) => ({ ...prev, visibility: v }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                    newNote.visibility === v
                      ? v === "public"
                        ? "border-[#00F2FE] bg-[#00F2FE]/10 text-[#00F2FE]"
                        : "border-[#FF2A85] bg-[#FF2A85]/10 text-[#FF2A85]"
                      : "border-white/10 text-white/40"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleAddNote}
            className="w-full py-3 rounded-xl bg-[#FF2A85] text-white font-semibold text-sm hover:bg-[#FF2A85]/90 transition-colors"
          >
            Create Note
          </button>
        </motion.div>
      )}
    </div>
  );
}
