/** Styles communs aux formulaires de connexion et d'inscription. */
export const AUTH_FORM_STYLES = `
  .mobile-brand { display: none; align-items: center; gap: 10px; margin-bottom: 28px; font-size: 17px; font-weight: 700; }
  .mobile-brand .mark { display: grid; place-items: center; width: 34px; height: 34px; color: #fff; background: linear-gradient(135deg, var(--brand), #1aa37a); border-radius: 10px; }
  .mobile-brand .mark .icon { font-size: 20px; }
  h1 { font-size: 28px; line-height: 1.2; letter-spacing: -.02em; }
  .lead { margin: 8px 0 28px; color: var(--text-3); font-size: 15px; }
  form { display: grid; gap: 18px; }
  .password { position: relative; }
  .password .input { padding-right: 44px; }
  .toggle { position: absolute; top: 50%; right: 4px; display: grid; place-items: center; width: 34px; height: 34px; color: var(--text-3); background: none; border: 0; border-radius: 7px; transform: translateY(-50%); }
  .toggle:hover { color: var(--text); background: var(--surface-2); } .toggle .icon { font-size: 20px; }
  .input.invalid { border-color: var(--neg); } .input.invalid:focus { box-shadow: 0 0 0 3px rgba(224, 83, 63, .15); }
  .field-error { display: flex; align-items: center; gap: 4px; color: var(--neg-text); font-size: 12.5px; }
  .field-error .icon { font-size: 15px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 14px; cursor: pointer; }
  .check input { width: 16px; height: 16px; accent-color: var(--brand); }
  .submit { margin-top: 4px; }
  .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .switch { margin-top: 24px; color: var(--text-3); font-size: 14px; text-align: center; }
  .switch a { font-weight: 600; text-decoration: none; } .switch a:hover { text-decoration: underline; }
  @media (max-width: 960px) { .mobile-brand { display: flex; } }
`;
