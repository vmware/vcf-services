def resource_name(prefix, region):
    return prefix + "-" + region["name"]
end

def selector(kind, labels, path=""):
    result = {
        "kind": kind,
        "labels": labels,
    }
    if path:
        result["path"] = path
    end
    return result
end

def documents(data, server_func, clients_func=None, singleton_func=None):
    docs = []

    if singleton_func:
        for doc in singleton_func():
            docs.append(doc)
        end
    end

    for region in data.values.regions:
        for doc in server_func(region):
            docs.append(doc)
        end

        if clients_func:
            for doc in clients_func(region):
                docs.append(doc)
            end
        end
    end

    return docs
end
