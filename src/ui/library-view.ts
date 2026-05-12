// Library panel: lists built-in / recorded / file samples and supports drag-to-pad.

import { BUILTIN_SOUNDS, BuiltinSound } from "../sounds/library";
import type { Sample } from "../types";
import { bindTap } from "./bind-tap";

export interface LibraryItem {
  id: string;
  name: string;
  category?: string;
  color?: string;
  source: "builtin" | "recorded" | "file";
}

export interface LibraryEvents {
  onAssign(item: LibraryItem): void;
  onPreview(item: LibraryItem): void;
  onDeleteRecorded?(item: LibraryItem): void;
}

export class LibraryView {
  el: HTMLElement;
  tabs: NodeListOf<HTMLButtonElement>;
  currentTab: "builtin" | "recorded" | "files" = "builtin";
  recorded: LibraryItem[] = [];
  files: LibraryItem[] = [];
  private evs: LibraryEvents;

  constructor(listEl: HTMLElement, tabsEl: HTMLElement, evs: LibraryEvents) {
    this.el = listEl;
    this.evs = evs;
    this.tabs = tabsEl.querySelectorAll("button.tab");
    this.tabs.forEach((t) => {
      bindTap(t, () => {
        this.currentTab = (t.dataset.tab as any) || "builtin";
        this.tabs.forEach((b) => b.classList.toggle("active", b === t));
        this.render();
      });
    });
    this.render();
  }

  addRecorded(item: LibraryItem) {
    this.recorded.unshift(item);
    if (this.currentTab === "recorded") this.render();
  }
  addFile(item: LibraryItem) {
    this.files.unshift(item);
    if (this.currentTab === "files") this.render();
  }

  removeRecorded(id: string) {
    this.recorded = this.recorded.filter((r) => r.id !== id);
    if (this.currentTab === "recorded") this.render();
  }

  private currentItems(): LibraryItem[] {
    if (this.currentTab === "builtin") {
      return BUILTIN_SOUNDS.map((s: BuiltinSound) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        color: s.color,
        source: "builtin" as const,
      }));
    }
    if (this.currentTab === "recorded") return this.recorded;
    return this.files;
  }

  private render() {
    this.el.innerHTML = "";
    const items = this.currentItems();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.style.color = "var(--fg-dim)";
      empty.style.padding = "12px";
      empty.style.fontSize = "0.85rem";
      empty.textContent =
        this.currentTab === "recorded" ? "まだ録音はありません" : "ファイル取り込みはまだありません";
      this.el.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "lib-item";
      row.draggable = true;
      row.dataset.id = item.id;
      const dot = document.createElement("span");
      dot.style.cssText = `width:8px;height:8px;border-radius:2px;background:${item.color || "#999"};display:inline-block;`;
      const name = document.createElement("span");
      name.textContent = item.name;
      name.style.cursor = "pointer";
      bindTap(name, () => this.evs.onAssign(item));
      const cat = document.createElement("span");
      cat.className = "cat";
      cat.textContent = item.category || "";
      const preview = document.createElement("button");
      preview.className = "preview";
      preview.textContent = "▶";
      bindTap(preview, (e) => {
        e.stopPropagation();
        this.evs.onPreview(item);
      });
      row.append(dot, name, cat, preview);

      if (item.source === "recorded" && this.evs.onDeleteRecorded) {
        const del = document.createElement("button");
        del.className = "preview";
        del.textContent = "✕";
        del.title = "削除";
        bindTap(del, (e) => {
          e.stopPropagation();
          this.evs.onDeleteRecorded!(item);
        });
        row.appendChild(del);
      }

      row.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/sampler-item", JSON.stringify(item));
      });
      this.el.appendChild(row);
    }
  }
}
