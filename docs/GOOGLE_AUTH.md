# Acceso con Google en Glu

La versión 0.5.0 permite Google en web y macOS, conservando el código por correo como alternativa. El cliente usa Supabase OAuth con PKCE S256, estado aleatorio por intento y verificación final del usuario contra Supabase. No necesita SMTP para Google.

## Configurar el proveedor

1. En Google Cloud, utiliza un cliente OAuth de tipo **Aplicación web** y configura su pantalla de consentimiento. Mientras esté en Testing, añade las cuentas de prueba que vayan a usarlo.
2. Añade esta URI exacta a **Authorized redirect URIs** de Google: `https://pnqonvkpdpteqgplyelg.supabase.co/auth/v1/callback` (cambia el proyecto si usas otro).
3. En Supabase → Authentication → Sign In / Providers → Google, habilita Google e introduce Client ID y Client Secret. Mantén la comprobación de nonce y la verificación de correo predeterminadas. El secreto solo va en Supabase, nunca en `.env` del frontend, repositorio ni chat.
4. En Supabase → Authentication → URL Configuration → Redirect URLs añade `http://127.0.0.1:42813/auth/callback**`. Glu añade un estado aleatorio en la query; el comodín permite esa query. El listener nativo exige la ruta exacta y valida ese estado.
5. Para web, añade la URL real de la página donde se muestra el login seguida de `**` para admitir la query de retorno. Usa HTTPS en producción y limita la URL a la ruta concreta. Por ejemplo, en desarrollo: `http://127.0.0.1:1420/**`. Configura Site URL con el sitio web real cuando esté desplegado.

El redirect de Google apunta a Supabase; los Redirect URLs de Supabase apuntan a Glu. Son dos pasos distintos.

## Flujo de Mac

Glu abre el navegador del sistema. Antes de abrirlo, inicia un listener enlazado únicamente a `127.0.0.1:42813`, que deja de escuchar tras recibir el retorno válido, cancelar o transcurrir tres minutos. Si el puerto está ocupado muestra un error, sin abrir un retorno que no puede recibir. La respuesta HTML no incluye códigos ni tokens y no afirma que el acceso haya terminado antes de verificarlo.

El código de autorización se intercambia desde la app con el verificador PKCE guardado durante ese intento. La sesión se guarda en Keychain; el estado y los verificadores temporales van en sessionStorage con claves separadas. No se entregan tokens de sesión al navegador externo. Si cierras Glu durante el acceso, vuelve a iniciar el flujo.

## Verificación

- El botón comprueba si el proveedor Google está habilitado antes de abrir el navegador.
- Pruebas e2e: retorno OAuth con PKCE, rechazo de retorno no solicitado y proveedor deshabilitado, además del flujo por correo.
- Pruebas Rust: validación de destino del navegador y rechazo de rutas/estados/métodos incorrectos en el callback.
- La prueba real requiere guardar las credenciales del cliente en Supabase, permitir los Redirect URLs y que el usuario complete Google.

Referencias: https://supabase.com/docs/guides/auth/social-login/auth-google y https://supabase.com/docs/guides/auth/sessions/pkce-flow
