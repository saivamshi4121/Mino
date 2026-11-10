declare global {
  interface Window {
    island: {
      setHover: (hovering: boolean) => void
    }
  }
}

export {}
