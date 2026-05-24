export async function paginate(model, query = {}, options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(100, Number(options.limit || 20)));
    const skip = (page - 1) * limit;
    const countPromise = model.countDocuments(query);
    let docsQuery = model.find(query).skip(skip).limit(limit);
    if (options.sort) {
        docsQuery = docsQuery.sort(options.sort);
    }
    if (options.populate) {
        docsQuery = docsQuery.populate(options.populate);
    }
    const [total, docs] = await Promise.all([countPromise, docsQuery.exec()]);
    const totalPages = Math.ceil(total / limit);
    return {
        docs,
        meta: {
            page,
            limit,
            total,
            totalPages,
        },
    };
}
