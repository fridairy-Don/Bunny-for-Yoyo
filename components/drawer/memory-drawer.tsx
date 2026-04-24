"use client";

import { useState } from "react";

import type { DailySession, DistilledMemory } from "../../lib/memory/session-store";
import { CloseIcon } from "../icons";
import { MemoryDetailView } from "../memory/memory-detail";
import { ParentTools } from "../memory/parent-tools";
import { PolaroidWall } from "../memory/polaroid-wall";

export type MemoryGroup = {
  dateKey: string;
  dateLabel: string;
  entries: DistilledMemory[];
};

type Props = {
  open: boolean;
  memories: DistilledMemory[];
  memoryGroups: MemoryGroup[];
  memoryDetail: DistilledMemory | null;
  memoryDetailSession: DailySession | null;
  memConfirmId: string | null;
  resetConfirming: boolean;
  // Increments whenever save-to-memory lands a new session so the wall
  // can refetch without having to subscribe to the conversation hook.
  wallRefreshKey: number;
  onClose: () => void;
  onOpenDetail: (mem: DistilledMemory) => void;
  onCloseDetail: () => void;
  onRequestDelete: (id: string | null) => void;
  onConfirmDelete: (id: string) => void;
  onRequestReset: () => void;
  onCancelReset: () => void;
  onConfirmReset: () => Promise<void> | void;
};

export function MemoryDrawer({
  open,
  memories,
  memoryGroups,
  memoryDetail,
  memoryDetailSession,
  memConfirmId,
  resetConfirming,
  wallRefreshKey,
  onClose,
  onOpenDetail,
  onCloseDetail,
  onRequestDelete,
  onConfirmDelete,
  onRequestReset,
  onCancelReset,
  onConfirmReset,
}: Props) {
  const [view, setView] = useState<"wall" | "list">("wall");
  return (
    <div className={`drawer ${open ? "show" : ""}`}>
      <div className="drawer-head">
        <div>
          <h3>our memories</h3>
          <div className="sub">{memories.length} kept</div>
        </div>
        <button
          className="close"
          onClick={() => {
            onClose();
            onCloseDetail();
          }}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="drawer-body">
        {memoryDetail ? (
          <MemoryDetailView
            memory={memoryDetail}
            session={memoryDetailSession}
            onBack={onCloseDetail}
          />
        ) : (
          <>
            <div className="memory-view-tabs">
              <button
                type="button"
                className={`memory-view-tab ${view === "wall" ? "active" : ""}`}
                onClick={() => setView("wall")}
              >
                wall
              </button>
              <button
                type="button"
                className={`memory-view-tab ${view === "list" ? "active" : ""}`}
                onClick={() => setView("list")}
              >
                list
              </button>
            </div>

            {view === "wall" ? (
              <PolaroidWall
                memories={memories}
                onOpenMemory={onOpenDetail}
                refreshKey={wallRefreshKey}
              />
            ) : memories.length === 0 ? (
              <div className="mem-empty">
                nothing saved yet.
                <br />
                tap <em>save to memory</em> after a talk.
              </div>
            ) : (
              memoryGroups.map((group) => (
                <div key={group.dateKey}>
                  <div className="mem-day">{group.dateLabel}</div>
                  {group.entries.map((mem) => {
                    const confirming = memConfirmId === mem.id;
                    return (
                      <div
                        key={mem.id}
                        className={`mem-row ${confirming ? "confirming" : ""}`}
                      >
                        <span className="pin" />
                        <div className="date">{mem.type.replace("_", " ")}</div>
                        <button
                          type="button"
                          className="mem-delete"
                          aria-label="remove this memory"
                          title="remove this memory"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestDelete(confirming ? null : mem.id);
                          }}
                        >
                          ×
                        </button>
                        <div
                          className="txt"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (confirming) return;
                            onOpenDetail(mem);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!confirming) onOpenDetail(mem);
                            }
                          }}
                        >
                          {mem.content}
                        </div>
                        {confirming ? (
                          <div className="mem-confirm">
                            <span>remove this memory only?</span>
                            <div className="mem-confirm-actions">
                              <button
                                type="button"
                                className="mem-confirm-yes"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onConfirmDelete(mem.id);
                                }}
                              >
                                remove
                              </button>
                              <button
                                type="button"
                                className="mem-confirm-no"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRequestDelete(null);
                                }}
                              >
                                keep
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="arrow">open →</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <ParentTools
              resetConfirming={resetConfirming}
              onRequestReset={onRequestReset}
              onCancelReset={onCancelReset}
              onConfirmReset={onConfirmReset}
            />
          </>
        )}
      </div>
    </div>
  );
}
