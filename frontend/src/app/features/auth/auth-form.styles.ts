/** Styles communs aux formulaires de connexion et d'inscription. */
export const AUTH_FORM_STYLES = `
  .mobile-brand { display: none; align-items: center; gap: 10px; margin-bottom: 8px; color: var(--navy); font-size: 16px; font-weight: 700; letter-spacing: -.015em; }
  .mobile-pitch { display: none; margin-bottom: 28px; color: var(--text-3); font-size: 13.5px; }
  h1 { font-size: 24px; line-height: 1.25; letter-spacing: -.025em; }
  .lead { margin: 6px 0 28px; color: var(--text-3); font-size: 14px; }
  form { display: grid; gap: 16px; }
  .password { position: relative; }
  .password .input { padding-right: 44px; }
  .toggle { position: absolute; top: 50%; right: 4px; display: grid; place-items: center; width: 28px; height: 28px; color: var(--text-4); background: none; border: 0; border-radius: var(--r-sm); transform: translateY(-50%); }
  .toggle:hover { color: var(--text); background: var(--surface-3); }
  .toggle:focus-visible { box-shadow: var(--focus); } .toggle .icon { font-size: 18px; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 13.5px; cursor: pointer; }
  .check input { width: 15px; height: 15px; accent-color: var(--primary); }
  .submit { margin-top: 4px; }
    .switch { margin-top: 24px; color: var(--text-3); font-size: 13.5px; text-align: center; }
  .switch a { color: var(--primary-text); font-weight: 600; text-decoration: underline; text-decoration-color: var(--primary-100); text-underline-offset: 3px; } .switch a:hover { text-decoration-color: currentColor; }
  @media (max-width: 960px) { .mobile-brand { display: flex; } .mobile-pitch { display: block; } }
`;
