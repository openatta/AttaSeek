import React from 'react';

interface AppProps {
  title: string;
  count: number;
}

export default function App({ title, count }: AppProps) {
  const [items, setItems] = React.useState<string[]>([]);

  const addItem = (name: string) => {
    setItems((prev) => [...prev, name]);
  };

  return (
    <div className="app">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <ul className="item-list">
        {items.map((item, i) => (
          <li key={i} className="item">
            {item}
          </li>
        ))}
      </ul>
      <button onClick={() => addItem(`Item ${items.length + 1}`)}>
        Add Item
      </button>
    </div>
  );
}
// TODO: add more features
