# LUKS Full-Disk Encryption Runbook

One-time manual procedure. Must be completed BEFORE production deployment.

## Prerequisites

- Hetzner dedicated/cloud server with Rescue Mode access
- SSH access to the server (root)
- KVM console access (Hetzner Robot panel) as fallback
- At least two key custodians for the LUKS passphrase
- The server's data disk identified (typically `/dev/sda` or `/dev/nvme0n1`)

> **WARNING:** This procedure will ERASE ALL DATA on the target disk. Perform only on a fresh server or after backing up everything.

## Overview

| Step | Action | Where |
|------|--------|-------|
| 1 | Boot into Rescue Mode | Hetzner Robot panel |
| 2 | Partition and encrypt disk | Rescue Mode SSH |
| 3 | Install OS on encrypted volume | Rescue Mode SSH |
| 4 | Configure Dropbear for remote unlock | Installed OS |
| 5 | Test reboot cycle | Remote SSH |
| 6 | Document key custodians | Offline |

## Step 1: Boot into Rescue Mode

1. Log into Hetzner Robot panel (https://robot.hetzner.com)
2. Select the server
3. Go to **Rescue** tab
4. Activate Rescue Mode (Linux 64-bit)
5. Note the temporary root password displayed
6. Go to **Reset** tab and perform a hardware reset
7. SSH into the server using the rescue credentials:
   ```bash
   ssh root@<server-ip>
   ```

## Step 2: Partition and Encrypt

Identify the target disk:
```bash
lsblk
# Look for the primary disk (e.g., /dev/sda or /dev/nvme0n1)
DISK=/dev/sda   # adjust as needed
```

Create partition layout:
```bash
# Create GPT partition table
parted -s "$DISK" mklabel gpt

# Boot partition (unencrypted, 1GB)
parted -s "$DISK" mkpart primary ext4 1MiB 1025MiB
parted -s "$DISK" set 1 boot on

# LUKS partition (rest of disk)
parted -s "$DISK" mkpart primary 1025MiB 100%
```

Encrypt the data partition:
```bash
# Format with LUKS2 (AES-256-XTS, argon2id KDF)
cryptsetup luksFormat --type luks2 \
  --cipher aes-xts-plain64 \
  --key-size 512 \
  --hash sha512 \
  --pbkdf argon2id \
  "${DISK}2"

# You will be prompted to type YES and enter the passphrase
# Use a strong passphrase (40+ characters recommended)
# RECORD THIS PASSPHRASE SECURELY - see Key Custodians section
```

Open the encrypted volume:
```bash
cryptsetup luksOpen "${DISK}2" crypt_root
```

Format the filesystems:
```bash
# Boot partition
mkfs.ext4 -L boot "${DISK}1"

# Root filesystem on encrypted volume
mkfs.ext4 -L root /dev/mapper/crypt_root
```

## Step 3: Install OS on Encrypted Volume

Mount and install:
```bash
mount /dev/mapper/crypt_root /mnt
mkdir -p /mnt/boot
mount "${DISK}1" /mnt/boot

# Install Ubuntu 24.04 base system
debootstrap noble /mnt http://archive.ubuntu.com/ubuntu

# Mount virtual filesystems
mount --bind /dev /mnt/dev
mount --bind /proc /mnt/proc
mount --bind /sys /mnt/sys

# Chroot into the new system
chroot /mnt /bin/bash
```

Inside chroot, configure the system:
```bash
# Set hostname
echo "everyskill-prod" > /etc/hostname

# Configure fstab
cat > /etc/fstab << 'FSTAB'
/dev/mapper/crypt_root  /       ext4  errors=remount-ro  0  1
LABEL=boot              /boot   ext4  defaults           0  2
FSTAB

# Configure crypttab
cat > /etc/crypttab << 'CRYPTTAB'
crypt_root  UUID=<UUID-of-DISK2>  none  luks,discard
CRYPTTAB
# Get UUID with: blkid ${DISK}2 (run outside chroot if needed)

# Install kernel and boot essentials
apt-get update
apt-get install -y linux-image-generic linux-headers-generic \
  grub-pc cryptsetup-initramfs openssh-server

# Install GRUB
grub-install "$DISK"
update-grub

# Set root password (temporary, will use SSH keys)
passwd root

# Update initramfs with cryptsetup support
update-initramfs -u -k all
```

## Step 4: Configure Dropbear for Remote Unlock

Dropbear provides SSH access during early boot (initramfs) so you can enter the LUKS passphrase remotely without KVM console access.

```bash
# Still inside chroot
apt-get install -y dropbear-initramfs

# Configure Dropbear to listen on port 2222 (avoid conflict with main SSH)
cat > /etc/dropbear/initramfs/dropbear.conf << 'DROPBEAR'
DROPBEAR_OPTIONS="-p 2222 -s -j -k"
DROPBEAR
# -p 2222: alternate port
# -s: disable password login
# -j -k: disable port forwarding

# Add authorized SSH keys for unlock access
# Copy your public key(s) here:
cat > /etc/dropbear/initramfs/authorized_keys << 'KEYS'
# Paste SSH public keys of authorized personnel here
# ssh-ed25519 AAAA... admin@everyskill
KEYS
chmod 600 /etc/dropbear/initramfs/authorized_keys

# Configure network in initramfs (static IP for Hetzner)
cat >> /etc/initramfs-tools/initramfs.conf << 'NETWORK'
# Static IP for LUKS unlock (adjust to your server's IP)
IP=<server-ip>::<gateway-ip>:<netmask>::eth0:off
NETWORK

# Rebuild initramfs with Dropbear
update-initramfs -u -k all
```

## Step 5: Reboot Test Procedure

Exit chroot and unmount:
```bash
exit  # leave chroot
umount /mnt/sys /mnt/proc /mnt/dev /mnt/boot /mnt
cryptsetup luksClose crypt_root
```

Deactivate Rescue Mode in Hetzner Robot panel, then reboot:
```bash
reboot
```

### Unlock Sequence

After reboot, the server will pause at initramfs waiting for LUKS passphrase:

```bash
# Connect via Dropbear on port 2222
ssh -p 2222 root@<server-ip>

# Unlock the encrypted volume
echo -n "<passphrase>" | cryptroot-unlock

# Connection will drop as boot continues
# Wait 30 seconds, then connect normally
ssh root@<server-ip>
```

### Verify Encryption

After successful boot:
```bash
# Confirm encrypted volume is active
lsblk
# Should show: sda2 -> crypt_root (type: crypt)

# Verify LUKS status
cryptsetup status crypt_root

# Check mount
df -h /
# Should show /dev/mapper/crypt_root mounted at /
```

## Emergency Procedures

### KVM Console Unlock

If Dropbear is unreachable (network issue, misconfiguration):

1. Log into Hetzner Robot panel
2. Go to server > **KVM Console** (or request KVM access)
3. The console will show the LUKS passphrase prompt
4. Type the passphrase directly
5. Server will continue booting

### Lost Passphrase Recovery

**There is no recovery if the passphrase is lost.** This is by design.

Mitigation:
- Store the passphrase with at least two key custodians (see below)
- Consider adding a second LUKS key slot as backup:
  ```bash
  cryptsetup luksAddKey /dev/sda2
  ```

### Disk Failure

If the disk fails, data is unrecoverable without:
1. A working backup (from `backup.sh`)
2. The backup encryption passphrase (separate from LUKS passphrase)

This is why automated off-site backups are critical.

## Key Custodians

The LUKS passphrase must be stored securely with at least two people/locations:

| Custodian | Storage Method | Access |
|-----------|---------------|--------|
| Primary admin | Password manager (1Password/Bitwarden) | Immediate |
| Secondary admin | Password manager (separate account) | Immediate |
| Offline backup | Printed, sealed envelope in secure location | Emergency only |

**Rules:**
- Never transmit the passphrase over email or chat
- Rotate if any custodian leaves the organization
- Test unlock procedure quarterly

## Backup Encryption vs LUKS Encryption

These are two separate encryption layers:

| Layer | Protects | Passphrase |
|-------|----------|------------|
| LUKS | Data at rest on the server disk | LUKS passphrase (entered at boot) |
| GPG (backup.sh) | Backup files in transit and at rest | Backup passphrase (`/etc/everyskill/backup-passphrase`) |

Both passphrases must be stored securely. They should be different.

## Post-Encryption Server Setup

After LUKS is configured and the server boots successfully:

1. Install Docker and Docker Compose
2. Install Tailscale (reconfigure to avoid port 443 conflict with Caddy)
3. Create `/opt/everyskill/` directory for deployment files
4. Create `/etc/everyskill/` directory for secrets
5. Create `/backups/` directory for local backup storage
6. Proceed with `docker compose up` deployment
