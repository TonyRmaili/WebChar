import React, { useMemo, useState } from "react";


const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 360;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 180;
const START_X = 120;
const START_Y = 80;
const OFFSET_X = 28;
const OFFSET_Y = 24;

function clampSize(width, height) {
  return {
    width: Math.max(MIN_WIDTH, width),
    height: Math.max(MIN_HEIGHT, height),
  };
}

function makeWindowId(file) {
  return file.id ?? file.path ?? file.title ?? crypto.randomUUID();
}

export default function FilePopup() {
  const [windows, setWindows] = useState([]);
  const [zCounter, setZCounter] = useState(10);

  const nextZ = () => {
    const newZ = zCounter + 1;
    setZCounter(newZ);
    return newZ;
  };

  const openWindow = (file) => {
    const id = makeWindowId(file);

    setWindows((prev) => {
      const existing = prev.find((w) => w.id === id);
      const newZ = zCounter + 1;

      if (existing) {
        setZCounter(newZ);
        return prev.map((w) =>
          w.id === id
            ? {
                ...w,
                isOpen: true,
                isMinimized: false,
                zIndex: newZ,
                title: file.title ?? file.name ?? w.title,
                content: file.content ?? w.content,
                path: file.path ?? w.path,
              }
            : w
        );
      }

      const openCount = prev.length;
      const { width, height } = clampSize(
        file.width ?? DEFAULT_WIDTH,
        file.height ?? DEFAULT_HEIGHT
      );

      setZCounter(newZ);

      return [
        ...prev,
        {
          id,
          title: file.title ?? file.name ?? "Untitled",
          type: file.type ?? "file",
          content: file.content ?? "",
          path: file.path ?? "",
          isOpen: true,
          isMinimized: false,
          x: file.x ?? START_X + openCount * OFFSET_X,
          y: file.y ?? START_Y + openCount * OFFSET_Y,
          width,
          height,
          zIndex: newZ,
        },
      ];
    });

    return id;
  };

  const closeWindow = (id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  };

  const minimizeWindow = (id) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMinimized: true } : w
      )
    );
  };

  const restoreWindow = (id) => {
    const newZ = nextZ();

    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, isMinimized: false, isOpen: true, zIndex: newZ }
          : w
      )
    );
  };

  const toggleMinimize = (id) => {
    const target = windows.find((w) => w.id === id);
    if (!target) return;

    if (target.isMinimized) {
      restoreWindow(id);
    } else {
      minimizeWindow(id);
    }
  };

  const focusWindow = (id) => {
    const newZ = nextZ();

    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: newZ } : w))
    );
  };

  const moveWindow = (id, x, y) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y } : w))
    );
  };

  const resizeWindow = (id, width, height) => {
    const size = clampSize(width, height);

    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              width: size.width,
              height: size.height,
            }
          : w
      )
    );
  };

  const updateWindowContent = (id, content) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, content } : w))
    );
  };

  const updateWindowTitle = (id, title) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, title } : w))
    );
  };

  const getWindowById = (id) => windows.find((w) => w.id === id) ?? null;

  const minimizedWindows = useMemo(
    () => windows.filter((w) => w.isMinimized),
    [windows]
  );

  const openWindows = useMemo(
    () => windows.filter((w) => !w.isMinimized && w.isOpen),
    [windows]
  );

  return {
    windows,
    openWindows,
    minimizedWindows,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleMinimize,
    focusWindow,
    moveWindow,
    resizeWindow,
    updateWindowContent,
    updateWindowTitle,
    getWindowById,
  };
}