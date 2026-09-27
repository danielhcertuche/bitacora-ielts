/* Configuración pública. El identificador de cliente de OAuth no es un secreto: Google lo
 * publica en cada página que usa "Iniciar sesión con Google". Lo que protege el acceso es la
 * lista de orígenes autorizados del cliente y el permiso drive.file.
 * Vacío = la app funciona igual, pero sólo guarda en el dispositivo.
 */
window.CONFIG = {
  GOOGLE_CLIENT_ID: "32988120146-36h80f1kb7gll03e5lhj3em8smif1nk5.apps.googleusercontent.com"
};
