import { Component, output, input, HostListener } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header {
  isMobileMenuOpen = input(false);
  isDarkMode = input(false);
  
  mobileMenuToggled = output<void>();
  navLinkClicked = output<void>();
  themeToggled = output<void>();

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isMobileMenuOpen()) {
      this.closeMobileMenu();
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuToggled.emit();
  }

  closeMobileMenu(): void {
    // This will be handled by parent
  }

  onNavLinkClick(event: Event): void {
    event.preventDefault();
    this.navLinkClicked.emit();
  }

  onThemeToggle(): void {
    this.themeToggled.emit();
  }
}