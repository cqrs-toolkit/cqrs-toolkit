# Page snapshot

```yaml
- generic [ref=e3]:
    - heading "CQRS Client Demo" [level=1] [ref=e4]
    - generic [ref=e6]: 'mode: online-only | ws: true | status: ready | sync: todos=seeded notes=seeded'
    - generic [ref=e7]:
        - generic [ref=e8]:
            - link "Todos →" [ref=e9] [cursor=pointer]:
                - /url: /todos
            - paragraph [ref=e10]: No incomplete todos.
        - generic [ref=e11]:
            - link "Notes →" [ref=e12] [cursor=pointer]:
                - /url: /notes
            - list [ref=e13]:
                - listitem [ref=e14]:
                    - generic [ref=e15]: Original
                    - generic [ref=e16]: some body
    - generic [ref=e17]:
        - heading "Developer Tools" [level=2] [ref=e18]
        - link "Command Queue Inspector →" [ref=e19] [cursor=pointer]:
            - /url: /commands
```
