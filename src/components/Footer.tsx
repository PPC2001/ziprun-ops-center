export function Footer() {
  const email = 'pratik2612001@gmail.com';

  return (
    <footer className="app-footer">
      <div className="footer-glow" />
      <div className="footer-content" style={{ padding: '20px 32px' }}>
        {/* ── Bottom Row: Copyright & Developer Contact ── */}
        <div className="footer-bottom" style={{ paddingTop: 0 }}>
          <div className="footer-copyright">
            © {new Date().getFullYear()} ZipRun Ops Center. Designed & Developed by <strong> Pratik Chavan</strong>.
          </div>
          <div className="footer-tagline">
            Contact: <a href={`mailto:${email}`} className="footer-email-link">{email}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
