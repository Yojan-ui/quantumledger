import Link from "next/link";
import { ButtonLink, Container, Label, Text } from "@/components/ui";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main">
        <Container className="py-40">
          <Label>404</Label>
          <h1 className="mt-4 max-w-text text-h1-sm font-medium text-fg md:text-h1">
            This page was harvested. Just kidding.
          </h1>
          <Text className="mt-4 max-w-text">
            It doesn’t exist, or it moved. Nothing was decrypted on the way here.
          </Text>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <ButtonLink href="/">Go home</ButtonLink>
            <Link
              href="/#scan"
              className="text-small text-fg-2 transition-colors duration-150 hover:text-fg"
            >
              Or scan a site →
            </Link>
          </div>
          <p className="mt-6 font-mono text-label uppercase text-fg-3">
            Tip: press ⌘K to jump anywhere
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}
