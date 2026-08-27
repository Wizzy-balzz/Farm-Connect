export function gradeColor(grade) {
  const map = { A: "#1f6d3c", B: "#c17f3e", C: "#c0392b" };
  return map[grade] || "#6c7566";
}
