import { useContext } from "react";
import { DataContext } from "../context/DataContext.jsx";
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
export default useData;
