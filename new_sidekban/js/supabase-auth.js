(function () {
  "use strict";

  // ==================================================
  // 1. KONFIGURASI
  // ==================================================

  const BASE_URL = "https://sidekbanflood.web.id";
  const TAB_KEY = "sidekban_tab_authenticated";

  const PUBLIC_PAGES = new Set([
    "login.html",
    "register.html",
    "lupa-password.html",
    "reset-password.html"
  ]);

  const PRIVATE_PAGES = new Set([
    "monitoring.html",
    "riwayat.html",
    "kamera.html",
    "tentang.html",
    "akun.html"
  ]);

  function normalisePath() {
    let path = window.location.pathname
      .split("/")
      .filter(Boolean)
      .pop() || "index.html";

    path = path.toLowerCase();

    if (!path.includes(".")) {
      path += ".html";
    }

    return path;
  }

  const path = normalisePath();

  // Halaman utama dan index.html dianggap sebagai dashboard privat.
  const isRootDashboard =
    window.location.pathname === "/" ||
    path === "index.html";

  const isLoginPage = path === "login.html";
  const isResetPage = path === "reset-password.html";

  const isPrivatePage =
    PRIVATE_PAGES.has(path) || isRootDashboard;

  const isPublicPage =
    PUBLIC_PAGES.has(path) && !isRootDashboard;

  const initialParams = new URLSearchParams(
    window.location.search
  );

  const navigationEntry =
    performance.getEntriesByType("navigation")[0];

  const isHistoryNavigation =
    navigationEntry?.type === "back_forward";

  const isVerifiedCallback =
    isLoginPage &&
    initialParams.get("verified") === "1";

  const mustLoginAgain =
    isLoginPage &&
    (
      initialParams.get("auth_required") === "tab" ||
      isHistoryNavigation
    );

  const $ = id => document.getElementById(id);

  const absolutePage = (file, query = "") => {
    const url = new URL(file, BASE_URL);
    url.search = query;
    url.hash = "";
    return url.href;
  };

  function showPage() {
    document.documentElement.style.visibility = "visible";
  }

  function hidePage() {
    document.documentElement.style.visibility = "hidden";
  }

  function msg(
    text,
    target = "auth-message",
    success = false
  ) {
    const el = $(target);
    if (!el) return;

    el.textContent = text;
    el.classList.toggle("success", success);
    el.setAttribute("role", "status");
  }

  function setButton(button, disabled, text) {
    if (!button) return;

    button.disabled = disabled;

    if (text) {
      button.textContent = text;
    }
  }

  function getTabAuthenticated() {
    try {
      return sessionStorage.getItem(TAB_KEY) === "yes";
    } catch (error) {
      console.error("Gagal membaca penanda tab:", error);
      return false;
    }
  }

  function setTabAuthenticated() {
    try {
      sessionStorage.setItem(TAB_KEY, "yes");
      return true;
    } catch (error) {
      console.error("Gagal menyimpan penanda tab:", error);
      return false;
    }
  }

  function clearTabAuthenticated() {
    try {
      sessionStorage.removeItem(TAB_KEY);
    } catch (error) {
      console.error("Gagal menghapus penanda tab:", error);
    }
  }

  function redirectToLogin() {
    clearTabAuthenticated();

    window.location.replace(
      absolutePage("login.html", "auth_required=tab")
    );
  }

  // Sembunyikan dashboard sebelum pemeriksaan akses.
  if (isPrivatePage) {
    hidePage();
  }

  // ==================================================
  // 2. INISIALISASI
  // ==================================================

  document.addEventListener("DOMContentLoaded", async () => {
    // Halaman publik harus tetap terlihat, termasuk jika
    // konfigurasi Supabase bermasalah.
    if (!isPrivatePage) {
      showPage();
    }

    if (
      typeof supabaseClient === "undefined" ||
      !supabaseClient
    ) {
      console.error(
        "Supabase belum tersedia. Periksa js/supabase-config.js."
      );

      if (isPrivatePage) {
        redirectToLogin();
        return;
      }

      msg(
        "Supabase belum dapat dimuat. Periksa koneksi dan konfigurasi."
      );

      msg(
        "Supabase belum dapat dimuat. Periksa konfigurasi.",
        "signup-message"
      );

      return;
    }

    // ==================================================
    // 3. PENANGANAN RIWAYAT BROWSER
    // ==================================================

    if (isHistoryNavigation) {
      clearTabAuthenticated();
    }

    if (isPrivatePage) {
      window.addEventListener("pageshow", event => {
        if (!event.persisted) return;

        hidePage();
        redirectToLogin();
      });
    }

    // ==================================================
    // 4. CALLBACK AUTENTIKASI DAN RESET PASSWORD
    // ==================================================

    const initialHash = window.location.hash;

    const hasAuthCallback =
      initialParams.has("code") ||
      initialHash.includes("access_token=") ||
      initialHash.includes("token_hash=");

    const hasRecoveryType =
      initialParams.get("type") === "recovery" ||
      initialHash.includes("type=recovery");

    let recoveryReady = false;
    let recoveryFailed = false;
    let recoveryEventSeen = false;

    const resetForm = $("reset-form");

    if (isResetPage && resetForm) {
      resetForm.hidden = false;

      msg(
        "Memeriksa tautan pemulihan password..."
      );
    }

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          recoveryEventSeen = true;
          recoveryReady = true;
          recoveryFailed = false;

          if (resetForm) {
            resetForm.hidden = false;
          }

          msg(
            "Tautan pemulihan valid. Silakan buat kata sandi baru.",
            "auth-message",
            true
          );
        }
      }
    );

    // ==================================================
    // 5. PERIKSA SESI
    // ==================================================

    let session = null;

    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) {
        console.error(
          "Gagal memeriksa sesi:",
          error.message
        );
      } else {
        session = data.session;
      }
    } catch (error) {
      console.error("Kesalahan pemeriksaan sesi:", error);
    }

    // ==================================================
    // 6. PROTEKSI HALAMAN PRIVAT
    // ==================================================

    async function redirectToLoginAndClearSession(
      { signOut = false } = {}
    ) {
      clearTabAuthenticated();

      if (signOut) {
        try {
          const { error } =
            await supabaseClient.auth.signOut({
              scope: "local"
            });

          if (error) {
            console.error(
              "Gagal mengakhiri sesi lokal:",
              error.message
            );
          }
        } catch (error) {
          console.error("Kesalahan logout:", error);
        }
      }

      redirectToLogin();
    }

    async function checkPrivateAccess() {
      if (!isPrivatePage) return true;

      // Sesi Supabase saja tidak cukup. Tab harus memiliki
      // penanda login dari proses login yang berhasil.
      if (!getTabAuthenticated()) {
        await redirectToLoginAndClearSession();
        return false;
      }

      try {
        const { data, error } =
          await supabaseClient.auth.getUser();

        if (error || !data.user) {
          await redirectToLoginAndClearSession({
            signOut: true
          });

          return false;
        }

        showPage();
        return true;
      } catch (error) {
        console.error(
          "Pemeriksaan autentikasi gagal:",
          error
        );

        await redirectToLoginAndClearSession({
          signOut: true
        });

        return false;
      }
    }

    if (isPrivatePage) {
      const accessGranted = await checkPrivateAccess();

      if (!accessGranted) return;
    }

    // ==================================================
    // 7. PENGALIHAN OTOMATIS DARI LOGIN
    // ==================================================

    if (
      isLoginPage &&
      session &&
      !isVerifiedCallback &&
      !mustLoginAgain
    ) {
      if (getTabAuthenticated()) {
        window.location.replace(
          absolutePage("monitoring.html")
        );

        return;
      }

      // Jangan memberikan akses otomatis hanya karena
      // sesi lama masih tersimpan di Supabase.
      clearTabAuthenticated();
    }

    // ==================================================
    // 8. PANEL LOGIN DAN REGISTER
    // ==================================================

    const loginPanel = $("login-panel");
    const signupPanel = $("signup-panel");
    const showLogin = $("show-login");
    const showSignup = $("show-signup");

    function switchPanel(showRegister) {
      if (loginPanel) {
        loginPanel.hidden = showRegister;
      }

      if (signupPanel) {
        signupPanel.hidden = !showRegister;
      }

      if (showLogin) {
        showLogin.classList.toggle(
          "active",
          !showRegister
        );
      }

      if (showSignup) {
        showSignup.classList.toggle(
          "active",
          showRegister
        );
      }

      msg("", "auth-message");
      msg("", "signup-message");
    }

    if (showLogin) {
      showLogin.addEventListener(
        "click",
        () => switchPanel(false)
      );
    }

    if (showSignup) {
      showSignup.addEventListener(
        "click",
        () => switchPanel(true)
      );
    }

    // ==================================================
    // 9. TAMPILKAN PASSWORD
    // ==================================================

    const showPassword = $("show-password");

    if (showPassword) {
      showPassword.addEventListener("change", () => {
        const input = $("password");

        if (input) {
          input.type = showPassword.checked
            ? "text"
            : "password";
        }
      });
    }

    const showSignupPassword = $("show-signup-password");

    if (showSignupPassword) {
      showSignupPassword.addEventListener(
        "change",
        () => {
          [
            "signup-password",
            "signup-password-confirm"
          ].forEach(id => {
            const input = $(id);

            if (input) {
              input.type = showSignupPassword.checked
                ? "text"
                : "password";
            }
          });
        }
      );
    }

    // ==================================================
    // 10. REGISTER
    // ==================================================

    const signupForm =
      $("signup-form") || $("register-form");

    if (signupForm) {
      const onRegisterPage =
        signupForm.id === "register-form";

      const ids = onRegisterPage
        ? {
            username: "username",
            email: "email",
            password: "password",
            confirm: "password-confirm",
            button: "register-button",
            message: "auth-message"
          }
        : {
            username: null,
            email: "signup-email",
            password: "signup-password",
            confirm: "signup-password-confirm",
            button: "signup-button",
            message: "signup-message"
          };

      signupForm.addEventListener(
        "submit",
        async event => {
          event.preventDefault();

          const usernameInput = ids.username
            ? $(ids.username)
            : null;

          const emailInput = $(ids.email);
          const passwordInput = $(ids.password);
          const confirmInput = $(ids.confirm);
          const button = $(ids.button);

          if (
            !emailInput ||
            !passwordInput ||
            !confirmInput ||
            (ids.username && !usernameInput)
          ) {
            msg(
              "Form pendaftaran tidak lengkap. Periksa ID elemen HTML.",
              ids.message
            );
            return;
          }

          const username = usernameInput
            ? usernameInput.value.trim()
            : "";

          const email = emailInput.value.trim();
          const password = passwordInput.value;
          const confirm = confirmInput.value;

          if (
            usernameInput &&
            !/^[A-Za-z0-9_.-]{3,24}$/.test(username)
          ) {
            msg(
              "Username harus 3–24 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
              ids.message
            );
            return;
          }

          if (!email) {
            msg("Masukkan alamat email.", ids.message);
            return;
          }

          if (password.length < 6) {
            msg(
              "Kata sandi minimal 6 karakter.",
              ids.message
            );
            return;
          }

          if (password !== confirm) {
            msg(
              "Konfirmasi kata sandi tidak sama.",
              ids.message
            );
            return;
          }

          setButton(button, true, "Mendaftarkan...");

          try {
            const { data, error } =
              await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: absolutePage(
                    "login.html",
                    "verified=1"
                  ),
                  ...(usernameInput
                    ? { data: { username } }
                    : {})
                }
              });

            if (error) {
              console.error("Register error:", error);

              const errorText =
                String(error.message || "").toLowerCase();

              if (
                errorText.includes("already registered") ||
                errorText.includes("already exists") ||
                errorText.includes("user already")
              ) {
                msg(
                  "Email ini sudah terdaftar. Silakan login atau gunakan Lupa Password jika kamu tidak ingat kata sandinya.",
                  ids.message
                );
              } else {
                msg(
                  "Pendaftaran gagal: " + error.message,
                  ids.message
                );
              }

              return;
            }

            // Supabase dapat menyamarkan akun yang sudah ada
            // saat konfirmasi email diaktifkan. Dalam kondisi
            // tersebut identities dapat berupa array kosong.
            const existingAccount =
              data.user &&
              Array.isArray(data.user.identities) &&
              data.user.identities.length === 0;

            if (existingAccount) {
              msg(
                "Email ini kemungkinan sudah terdaftar. Coba login menggunakan email tersebut atau pilih Lupa Password.",
                ids.message
              );

              signupForm.reset();
              return;
            }

            if (data.session && data.user) {
              if (!setTabAuthenticated()) {
                await supabaseClient.auth.signOut({
                  scope: "local"
                });

                msg(
                  "Browser tidak mengizinkan penyimpanan sesi tab. Aktifkan penyimpanan situs lalu coba lagi.",
                  ids.message
                );

                return;
              }

              msg(
                "Akun berhasil dibuat. Mengalihkan ke Monitoring...",
                ids.message,
                true
              );

              window.location.replace(
                absolutePage("monitoring.html")
              );

              return;
            }

            msg(
              "Jika email belum terdaftar, tautan verifikasi akan dikirim. Jika email sudah terdaftar, silakan login atau gunakan Lupa Password. Periksa Inbox dan Spam.",
              ids.message,
              true
            );

            signupForm.reset();
          } catch (error) {
            console.error("Register exception:", error);

            msg(
              "Tidak dapat menghubungi Supabase. Periksa koneksi internet dan konfigurasi.",
              ids.message
            );
          } finally {
            setButton(button, false, "Buat Akun");
          }
        }
      );
    }

    // ==================================================
    // 11. CALLBACK VERIFIKASI EMAIL
    // ==================================================

    if (isVerifiedCallback) {
      switchPanel(false);
      clearTabAuthenticated();

      msg(
        "Verifikasi email selesai. Silakan login menggunakan email dan kata sandi.",
        "auth-message",
        true
      );

      if (session) {
        const { error } =
          await supabaseClient.auth.signOut({
            scope: "local"
          });

        if (error) {
          console.error(
            "Gagal mengakhiri sesi verifikasi:",
            error.message
          );
        }
      }

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }

    // ==================================================
    // 12. LOGIN
    // ==================================================

    const loginForm = $("login-form");

    if (loginForm) {
      loginForm.addEventListener(
        "submit",
        async event => {
          event.preventDefault();

          const emailInput = $("email");
          const passwordInput = $("password");
          const button = $("login-button");

          if (!emailInput || !passwordInput) {
            msg("Form login tidak lengkap.");
            return;
          }

          setButton(button, true, "Memeriksa...");

          try {
            const { data, error } =
              await supabaseClient.auth.signInWithPassword({
                email: emailInput.value.trim(),
                password: passwordInput.value
              });

            if (error) {
              console.error("Login error:", error);

              const errorText =
                String(error.message || "").toLowerCase();

              if (
                errorText.includes("email not confirmed")
              ) {
                msg(
                  "Email belum diverifikasi. Periksa email dan klik tautan verifikasi."
                );
              } else if (
                errorText.includes("invalid login credentials")
              ) {
                msg(
                  "Email atau kata sandi salah. Jika lupa kata sandi, gunakan Lupa Password."
                );
              } else {
                msg("Login gagal: " + error.message);
              }

              return;
            }

            if (!data.session || !data.user) {
              msg(
                "Login belum menghasilkan sesi. Silakan coba lagi."
              );
              return;
            }

            if (!setTabAuthenticated()) {
              await supabaseClient.auth.signOut({
                scope: "local"
              });

              msg(
                "Browser tidak mengizinkan penyimpanan sesi tab. Aktifkan penyimpanan situs lalu coba lagi."
              );

              return;
            }

            window.location.replace(
              absolutePage("monitoring.html")
            );
          } catch (error) {
            console.error("Login exception:", error);

            msg(
              "Tidak dapat menghubungi Supabase. Coba lagi."
            );
          } finally {
            setButton(button, false, "Masuk");
          }
        }
      );
    }

    // ==================================================
    // 13. LUPA PASSWORD
    // ==================================================

    const forgotForm = $("forgot-form");

    if (forgotForm) {
      forgotForm.addEventListener(
        "submit",
        async event => {
          event.preventDefault();

          const emailInput = $("email");
          const button = $("forgot-button");

          if (
            !emailInput ||
            !emailInput.value.trim()
          ) {
            msg(
              "Masukkan alamat email yang digunakan saat mendaftar."
            );
            return;
          }

          setButton(button, true, "Mengirim...");

          try {
            const { error } =
              await supabaseClient.auth.resetPasswordForEmail(
                emailInput.value.trim(),
                {
                  redirectTo: absolutePage(
                    "reset-password.html"
                  )
                }
              );

            if (error) {
              console.error(
                "Forgot password error:",
                error
              );

              msg(
                "Gagal mengirim tautan: " + error.message
              );

              return;
            }

            msg(
              "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa Inbox dan Spam.",
              "auth-message",
              true
            );
          } catch (error) {
            console.error(
              "Forgot password exception:",
              error
            );

            msg(
              "Tidak dapat menghubungi Supabase. Coba lagi."
            );
          } finally {
            setButton(
              button,
              false,
              "Kirim tautan pemulihan"
            );
          }
        }
      );
    }

    // ==================================================
    // 14. RESET PASSWORD
    // ==================================================

    if (isResetPage) {
      if (resetForm) {
        resetForm.hidden = false;
      }

      const cancelResetButton = $("cancel-reset");

      if (cancelResetButton) {
        cancelResetButton.addEventListener(
          "click",
          async event => {
            event.preventDefault();

            try {
              const { error } =
                await supabaseClient.auth.signOut({
                  scope: "local"
                });

              if (error) {
                console.error(
                  "Gagal mengakhiri sesi pemulihan:",
                  error.message
                );
              }
            } catch (error) {
              console.error(
                "Kesalahan saat membatalkan reset:",
                error
              );
            }

            clearTabAuthenticated();

            window.location.replace(
              absolutePage("login.html")
            );
          }
        );
      }

      if (
        !recoveryReady &&
        hasAuthCallback &&
        !recoveryEventSeen
      ) {
        await new Promise(resolve => {
          window.setTimeout(resolve, 1200);
        });

        const { data, error } =
          await supabaseClient.auth.getSession();

        if (error) {
          console.error(
            "Pemeriksaan sesi pemulihan gagal:",
            error.message
          );
        }

        if (recoveryEventSeen) {
          recoveryReady = true;
        } else if (data.session && hasRecoveryType) {
          recoveryReady = true;
        }
      }

      if (
        !recoveryReady &&
        hasRecoveryType &&
        session
      ) {
        recoveryReady = true;
      }

      if (recoveryReady) {
        recoveryFailed = false;

        if (resetForm) {
          resetForm.hidden = false;
        }

        msg(
          "Sesi pemulihan tersedia. Silakan buat kata sandi baru.",
          "auth-message",
          true
        );
      } else {
        recoveryFailed = true;

        if (resetForm) {
          resetForm.hidden = false;
        }

        msg(
          "Tautan belum terverifikasi atau tidak valid/kedaluwarsa. Minta tautan reset baru jika diperlukan.",
          "auth-message"
        );
      }

      if (resetForm) {
        resetForm.addEventListener(
          "submit",
          async event => {
            event.preventDefault();

            if (!recoveryReady || recoveryFailed) {
              msg(
                "Tautan pemulihan belum valid atau sudah kedaluwarsa. Minta tautan reset password baru."
              );

              return;
            }

            const passwordInput = $("password");
            const confirmInput = $("password-confirm");
            const button = $("reset-button");

            if (!passwordInput || !confirmInput) {
              msg("Form reset password tidak lengkap.");
              return;
            }

            const password = passwordInput.value;
            const confirm = confirmInput.value;

            if (password.length < 6) {
              msg("Kata sandi minimal 6 karakter.");
              return;
            }

            if (password !== confirm) {
              msg("Konfirmasi kata sandi tidak sama.");
              return;
            }

            setButton(button, true, "Menyimpan...");

            try {
              const {
                data,
                error: sessionError
              } = await supabaseClient.auth.getSession();

              if (sessionError || !data.session) {
                recoveryReady = false;
                recoveryFailed = true;

                msg(
                  "Sesi pemulihan sudah tidak tersedia. Minta tautan reset password baru."
                );

                return;
              }

              const { error } =
                await supabaseClient.auth.updateUser({
                  password
                });

              if (error) {
                console.error(
                  "Update password error:",
                  error.message
                );

                msg(
                  "Gagal memperbarui kata sandi: " +
                  error.message
                );

                return;
              }

              recoveryReady = false;
              recoveryFailed = true;

              clearTabAuthenticated();

              msg(
                "Kata sandi berhasil diperbarui. Mengalihkan ke halaman login...",
                "auth-message",
                true
              );

              const { error: signOutError } =
                await supabaseClient.auth.signOut({
                  scope: "local"
                });

              if (signOutError) {
                console.error(
                  "Sign out error:",
                  signOutError.message
                );
              }

              window.setTimeout(() => {
                window.location.replace(
                  absolutePage("login.html")
                );
              }, 1500);
            } catch (error) {
              console.error(
                "Reset password exception:",
                error
              );

              msg(
                "Terjadi kesalahan saat reset password. Coba minta tautan baru."
              );
            } finally {
              setButton(
                button,
                false,
                "Simpan kata sandi"
              );
            }
          }
        );
      }
    }

    // ==================================================
    // 15. LOGOUT
    // ==================================================

    window.sidekbanLogout = async function () {
      clearTabAuthenticated();

      try {
        const { error } =
          await supabaseClient.auth.signOut({
            scope: "local"
          });

        if (error) {
          console.error("Logout error:", error.message);
        }
      } catch (error) {
        console.error("Logout exception:", error);
      } finally {
        window.location.replace(
          absolutePage("login.html")
        );
      }
    };
  });
})();