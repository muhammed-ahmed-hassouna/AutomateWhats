import React, { useState, useEffect } from "react";
import { FaPrint, FaTimes, FaCheck, FaFilePdf } from "react-icons/fa";

export default function PrintManager({ files = [], onClose }) {
  const [selected, setSelected] = useState({});
  const [printing, setPrinting] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [defaultPrinter, setDefaultPrinter] = useState("");

  useEffect(() => {
    loadPrinters();
    // Auto-select all files initially
    const autoSelect = {};
    files.forEach(file => {
      autoSelect[file.path] = {
        selected: true,
        duplex: "long",
        color: true,
        copies: 1,
        nup: "1",
        printer: ""
      };
    });
    setSelected(autoSelect);
  }, [files]);

  async function loadPrinters() {
    const res = await window.api.getPrinters();
    if (res?.ok) {
      setPrinters(res.printers || []);
      setDefaultPrinter(res.default || "");
    }
  }

  function toggleFile(path) {
    setSelected(prev => ({
      ...prev,
      [path]: {
        ...(prev[path] || {}),
        selected: !(prev[path]?.selected)
      }
    }));
  }

  function updateOption(path, key, value) {
    setSelected(prev => ({
      ...prev,
      [path]: {
        ...(prev[path] || { selected: true }),
        [key]: value
      }
    }));
  }

  function selectAll() {
    const newSelected = {};
    files.forEach(file => {
      newSelected[file.path] = {
        ...(selected[file.path] || {}),
        selected: true
      };
    });
    setSelected(newSelected);
  }

  function deselectAll() {
    const newSelected = {};
    files.forEach(file => {
      newSelected[file.path] = {
        ...(selected[file.path] || {}),
        selected: false
      };
    });
    setSelected(newSelected);
  }

  async function handlePrint() {
    const jobs = files
      .filter(f => selected[f.path]?.selected)
      .map(f => ({
        path: f.path,
        filename: f.filename,
        options: {
          duplex: selected[f.path]?.duplex || "none",
          color: selected[f.path]?.color !== false,
          copies: selected[f.path]?.copies || 1,
          nup: selected[f.path]?.nup || "1",
          printer: selected[f.path]?.printer || defaultPrinter
        }
      }));

    if (jobs.length === 0) {
      alert("Please select at least one file to print");
      return;
    }

    setPrinting(true);
    try {
      const res = await window.api.printPdfs(jobs);
      if (res?.ok) {
        alert(`Successfully sent ${jobs.length} file(s) to printer!`);
        onClose?.();
      } else {
        alert("Print failed: " + (res?.error || "Unknown error"));
      }
    } catch (e) {
      alert("Print error: " + e.message);
    }
    setPrinting(false);
  }

  const selectedCount = files.filter(f => selected[f.path]?.selected).length;

  return (
    <div className="print-overlay" onClick={onClose}>
      <div className="print-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="print-header">
          <div className="print-title">
            <FaPrint /> Print Manager
          </div>
          <button className="print-close" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        {/* Summary */}
        <div className="print-summary">
          <div className="summary-item">
            <strong>{files.length}</strong> PDF file{files.length !== 1 ? "s" : ""} ready
          </div>
          <div className="summary-item">
            <strong>{selectedCount}</strong> selected for printing
          </div>
          <div className="summary-actions">
            <button onClick={selectAll} className="btn-small">Select All</button>
            <button onClick={deselectAll} className="btn-small">Deselect All</button>
          </div>
        </div>

        {/* File List */}
        <div className="print-files">
          {files.map((file) => {
            const opts = selected[file.path] || {};
            const isSelected = opts.selected;

            return (
              <div 
                key={file.path} 
                className={`print-file-item ${isSelected ? "selected" : ""}`}
              >
                <div className="file-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFile(file.path)}
                  />
                </div>

                <div className="file-icon">
                  <FaFilePdf />
                </div>

                <div className="file-info">
                  <div className="file-name">{file.filename}</div>
                  <div className="file-meta">{file.size}</div>
                </div>

                {isSelected && (
                  <div className="file-options">
                    {/* Printer Selection */}
                    <div className="option-group">
                      <label>Printer</label>
                      <select
                        value={opts.printer || defaultPrinter}
                        onChange={(e) => updateOption(file.path, "printer", e.target.value)}
                      >
                        {printers.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Duplex */}
                    <div className="option-group">
                      <label>Sides</label>
                      <select
                        value={opts.duplex || "long"}
                        onChange={(e) => updateOption(file.path, "duplex", e.target.value)}
                      >
                        <option value="none">Single-sided</option>
                        <option value="long">Double-sided (Long Edge)</option>
                        <option value="short">Double-sided (Short Edge)</option>
                      </select>
                    </div>

                    {/* Color */}
                    <div className="option-group">
                      <label>Color</label>
                      <select
                        value={opts.color !== false ? "color" : "grayscale"}
                        onChange={(e) => updateOption(file.path, "color", e.target.value === "color")}
                      >
                        <option value="color">Color</option>
                        <option value="grayscale">Black & White</option>
                      </select>
                    </div>

                    {/* Pages per sheet */}
                    <div className="option-group">
                      <label>Pages/Sheet</label>
                      <select
                        value={opts.nup || "1"}
                        onChange={(e) => updateOption(file.path, "nup", e.target.value)}
                      >
                        <option value="1">1 (Normal)</option>
                        <option value="2">2 (2-up)</option>
                        <option value="4">4 (4-up)</option>
                        <option value="6">6 (6-up)</option>
                        <option value="9">9 (9-up)</option>
                      </select>
                    </div>

                    {/* Copies */}
                    <div className="option-group">
                      <label>Copies</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={opts.copies || 1}
                        onChange={(e) => updateOption(file.path, "copies", parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="print-footer">
          <button className="btn-cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button 
            className="btn-print" 
            onClick={handlePrint}
            disabled={printing || selectedCount === 0}
            type="button"
          >
            {printing ? (
              "Printing..."
            ) : (
              <>
                <FaPrint /> Print {selectedCount > 0 && `(${selectedCount})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}