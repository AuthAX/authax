import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  signInOtpSF,
  verifyOtp,
  requestChangeEmail,
  changeEmail,
  requestDeleteAccountSF,
  deleteAccountSF,
  signOut,
  signOutAll,
  getViewer,
  requestOtpSchema,
  verifyOtpSchema,
} from "../auth-rpc";
import {
  Page,
  Button,
  Header,
  EmailInput,
  OtpInput,
  Toolbar,
  AuthLayout,
} from "@repo/shared-react";

export const Route = createFileRoute("/")({
  loader: () => getViewer(),
  component: App,
});

type Viewer = { userId: string; email: string };

function AuthFlow(props: { onSignedIn: () => void }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (step === "email") {
    return (
      <Page
        as="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await signInOtpSF({ data: { identifier: email } });
          if (result.success) {
            setTicket(result.ticket);
            setStep("otp");
            setError(null);
          } else {
            setError("Failed to send one-time password");
          }
        }}
      >
        <Header title="Welcome!" description="Let's get you signed in." />
        <EmailInput value={email} onChange={setEmail} error={error} />
        <Button
          type="submit"
          disabled={!requestOtpSchema.safeParse({ identifier: email }).success}
        >
          Send one-time password
        </Button>
      </Page>
    );
  }

  return (
    <Page
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await verifyOtp({
          data: { ticket, otp },
        });
        if (result.success) {
          props.onSignedIn();
        } else {
          setError("Invalid one-time password");
        }
      }}
    >
      <Header
        title="Check your email"
        description="Enter your one-time password."
      />
      <OtpInput value={otp} onChange={setOtp} error={error} />
      <Button
        type="submit"
        disabled={!verifyOtpSchema.safeParse({ ticket, otp }).success}
      >
        Continue
      </Button>
      <Button
        variant="secondary"
        type="button"
        onClick={async () => {
          const result = await signInOtpSF({ data: { identifier: email } });
          setTicket(result.ticket);
          setOtp("");
          setError(null);
        }}
      >
        Send a new one-time password
      </Button>
    </Page>
  );
}

function ChangeEmailFlow(props: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (step === "email") {
    return (
      <Page
        as="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await requestChangeEmail({
            data: { identifier: email },
          });

          if (result.success) {
            setTicket(result.ticket);
            setStep("otp");
            setError(null);
          } else {
            setError("Failed to send one-time password");
          }
        }}
      >
        <Header
          title="Change email"
          description="Enter your new email address."
        />
        <EmailInput value={email} onChange={setEmail} error={error} />
        <Button
          type="submit"
          disabled={!requestOtpSchema.safeParse({ identifier: email }).success}
        >
          Send one-time password
        </Button>
        <Button variant="secondary" type="button" onClick={props.onCancel}>
          Cancel
        </Button>
      </Page>
    );
  }

  return (
    <Page
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await changeEmail({
          data: { ticket, otp },
        });
        if (result.success) {
          props.onDone();
        } else {
          setError("Invalid one-time password");
        }
      }}
    >
      <Header
        title="Check your email"
        description="Enter your one-time password."
      />
      <OtpInput value={otp} onChange={setOtp} error={error} />
      <Button
        type="submit"
        disabled={!verifyOtpSchema.safeParse({ ticket, otp }).success}
      >
        Continue
      </Button>
      <Button
        variant="secondary"
        type="button"
        onClick={async () => {
          const result = await requestChangeEmail({
            data: { identifier: email },
          });

          if (result.success) {
            setTicket(result.ticket);
            setOtp("");
            setError(null);
          } else {
            setError("Failed to send one-time password");
          }
        }}
      >
        Send a new one-time password
      </Button>
      <Button variant="secondary" type="button" onClick={props.onCancel}>
        Cancel
      </Button>
    </Page>
  );
}

function DeleteAccountFlow(props: {
  ticket: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [ticket, setTicket] = useState(props.ticket);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Page
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await deleteAccountSF({
          data: { ticket, otp },
        });
        if (result.success) {
          props.onDone();
        } else {
          setError("Invalid one-time password");
        }
      }}
    >
      <Header
        title="Delete account"
        description="Enter the one-time password we sent to your email."
      />
      <OtpInput value={otp} onChange={setOtp} error={error} />
      <Button
        type="submit"
        disabled={!verifyOtpSchema.safeParse({ ticket, otp }).success}
      >
        Delete account
      </Button>
      <Button
        variant="secondary"
        type="button"
        onClick={async () => {
          const result = await requestDeleteAccountSF();

          if (result.success) {
            setTicket(result.ticket);
            setOtp("");
            setError(null);
          } else {
            setError("Failed to send one-time password");
          }
        }}
      >
        Send a new one-time password
      </Button>
      <Button variant="secondary" type="button" onClick={props.onCancel}>
        Cancel
      </Button>
    </Page>
  );
}

function Authenticated(props: {
  viewer: Viewer;
  onSignedOut: () => void;
  onEmailChanged: () => void;
}) {
  const [changingEmail, setChangingEmail] = useState(false);
  const [deleteTicket, setDeleteTicket] = useState<string | null>(null);

  if (deleteTicket !== null) {
    return (
      <DeleteAccountFlow
        ticket={deleteTicket}
        onDone={props.onSignedOut}
        onCancel={() => setDeleteTicket(null)}
      />
    );
  }

  if (changingEmail) {
    return (
      <ChangeEmailFlow
        onDone={() => {
          setChangingEmail(false);
          props.onEmailChanged();
        }}
        onCancel={() => setChangingEmail(false)}
      />
    );
  }

  return (
    <Page>
      <Toolbar email={props.viewer.email} />
      <Button variant="secondary" onClick={() => setChangingEmail(true)}>
        Change email
      </Button>
      <Button
        onClick={async () => {
          await signOut();
          props.onSignedOut();
        }}
      >
        Sign out
      </Button>
      <Button
        variant="secondary"
        onClick={async () => {
          await signOutAll();
          props.onSignedOut();
        }}
      >
        Sign out all devices
      </Button>
      <Button
        variant="secondary"
        onClick={async () => {
          const result = await requestDeleteAccountSF();

          if (result.success) {
            setDeleteTicket(result.ticket);
          } else {
            props.onSignedOut();
          }
        }}
      >
        Delete account
      </Button>
    </Page>
  );
}

function App() {
  const viewer = Route.useLoaderData();
  const router = useRouter();

  return (
    <AuthLayout demo="Kitchen sink example">
      {viewer ? (
        <Authenticated
          viewer={viewer}
          onSignedOut={() => router.invalidate()}
          onEmailChanged={() => router.invalidate()}
        />
      ) : (
        <AuthFlow onSignedIn={() => router.invalidate()} />
      )}
    </AuthLayout>
  );
}
