const viewerText = document.getElementById("viewer") as HTMLParagraphElement;
const emailForm = document.getElementById("email-form") as HTMLFormElement;
const otpForm = document.getElementById("otp-form") as HTMLFormElement;
const errorText = document.getElementById("error") as HTMLParagraphElement;

// Held between sending the OTP and verifying it
let ticket = "";

async function showViewer() {
  const response = await fetch("/api/viewer");
  const viewer: { email: string } | null = await response.json();

  if (viewer) {
    viewerText.textContent = `Signed in as ${viewer.email}`;
    viewerText.hidden = false;
    emailForm.hidden = true;
    otpForm.hidden = true;
  } else {
    emailForm.hidden = false;
  }
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: new FormData(emailForm).get("email") }),
  });

  if (!response.ok) {
    errorText.textContent = "Could not send a one-time password";
    return;
  }

  const body: { ticket: string } = await response.json();
  ticket = body.ticket;
  errorText.textContent = "";
  emailForm.hidden = true;
  otpForm.hidden = false;
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/api/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticket, otp: new FormData(otpForm).get("otp") }),
  });

  if (!response.ok) {
    errorText.textContent = "Wrong or expired one-time password";
    return;
  }

  errorText.textContent = "";
  await showViewer();
});

await showViewer();
