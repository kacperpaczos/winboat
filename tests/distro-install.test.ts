import { describe, expect, it } from "bun:test";
import { buildPkexecArgs, detectDistroFamily, getDockerInstallPlan } from "../src/renderer/lib/distro-install";

const osRelease = (id: string, idLike?: string) =>
    `NAME="Test"\nID=${id}\n${idLike ? `ID_LIKE=${idLike}\n` : ""}VERSION_ID="1"\n`;

describe("distro detection", () => {
    it("recognizes ubuntu as the debian family", () => {
        expect(detectDistroFamily(osRelease("ubuntu", "debian"))).toBe("debian");
    });

    it("recognizes debian itself", () => {
        expect(detectDistroFamily(osRelease("debian"))).toBe("debian");
    });

    it("recognizes fedora", () => {
        expect(detectDistroFamily(osRelease("fedora"))).toBe("fedora");
    });

    it("recognizes fedora derivatives via ID_LIKE", () => {
        expect(detectDistroFamily(osRelease("nobara", "fedora"))).toBe("fedora");
    });

    it("falls back to ID_LIKE for unknown debian derivatives", () => {
        expect(detectDistroFamily(osRelease("mx", "debian"))).toBe("debian");
    });

    it("recognizes opensuse-leap as the suse family", () => {
        expect(detectDistroFamily(osRelease("opensuse-leap", "suse opensuse"))).toBe("suse");
    });

    it("recognizes arch derivatives via ID_LIKE", () => {
        expect(detectDistroFamily(osRelease("endeavouros", "arch"))).toBe("arch");
    });

    it("is case-insensitive and strips quotes", () => {
        expect(detectDistroFamily('NAME="X"\nID="Ubuntu"\nID_LIKE="Debian"\n')).toBe("debian");
    });

    it("returns null for unsupported distros", () => {
        expect(detectDistroFamily(osRelease("alpine", "musl"))).toBeNull();
    });

    it("returns null for empty input", () => {
        expect(detectDistroFamily("")).toBeNull();
    });
});

describe("docker install plan", () => {
    it("installs distro-native packages on debian with a compose naming fallback", () => {
        const plan = getDockerInstallPlan("debian", "john");
        expect(plan[0]).toBe("apt-get update");
        expect(plan[1]).toBe(
            "apt-get install -y docker.io docker-compose-v2 || apt-get install -y docker.io docker-compose",
        );
        expect(plan.at(-1)).toBe("usermod -aG docker john");
    });

    it("installs moby-engine and docker-cli on fedora", () => {
        const plan = getDockerInstallPlan("fedora", "john");
        expect(plan[0]).toBe("dnf install -y moby-engine docker-cli docker-compose");
        expect(plan.at(-1)).toBe("usermod -aG docker john");
    });

    it("installs docker on arch", () => {
        const plan = getDockerInstallPlan("arch", "john");
        expect(plan[0]).toBe("pacman -Sy --noconfirm docker docker-compose");
        expect(plan.at(-1)).toBe("usermod -aG docker john");
    });

    it("installs docker on suse", () => {
        const plan = getDockerInstallPlan("suse", "john");
        expect(plan[0]).toBe("zypper --non-interactive install docker docker-compose");
        expect(plan.at(-1)).toBe("usermod -aG docker john");
    });

    it("enables and starts the docker service on every family", () => {
        for (const family of ["debian", "fedora", "arch", "suse"] as const) {
            expect(getDockerInstallPlan(family, "john")).toContain("systemctl enable --now docker");
        }
    });
});

describe("pkexec invocation", () => {
    it("joins the plan into a single bash -c invocation", () => {
        expect(buildPkexecArgs(["a", "b"])).toEqual(["bash", "-c", "a && b"]);
    });
});
