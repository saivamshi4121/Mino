function App(): React.JSX.Element {
  const handleMouseEnter = (): void => {
    window.island.setHover(true)
  }

  const handleMouseLeave = (): void => {
    window.island.setHover(false)
  }

  return (
    <div className="island-container">
      <div
        className="island-pill"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}

export default App
