export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0c" }}>
      {children}
    </div>
  );
}
