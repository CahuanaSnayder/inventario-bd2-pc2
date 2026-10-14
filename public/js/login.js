if (localStorage.getItem('token')) location.href = 'app.html';

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

fetch('/api/salud')
  .then((r) => r.json())
  .then((s) => {
    document.getElementById('estado-bd').textContent =
      `Conectado a la BD "${s.bd}" (${s.entorno === 'nube' ? 'Railway ☁' : 'local'})`;
  })
  .catch(() => {
    document.getElementById('estado-bd').textContent = 'Sin conexión con la base de datos';
  });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  const boton = form.querySelector('button');
  boton.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    location.href = 'app.html';
  } catch (err) {
    errorBox.textContent = err.message || 'No se pudo iniciar sesión';
    errorBox.hidden = false;
  } finally {
    boton.disabled = false;
  }
});
